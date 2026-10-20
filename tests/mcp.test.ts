import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { collectMcpEvents } from '../src/adapters/mcp.js';
import { aggregateMcpEvents, parseMcpTimestamp } from '../src/mcp-aggregate.js';
import type { McpCallRecord } from '../src/contracts.js';

const start = '2026-10-19T08:00:00.000Z';
const finish = '2026-10-19T08:00:01.000Z';
const tool = 'mcp__sample__lookup';
const meta = (id = 'session') => ({ type: 'session_meta', payload: { id } });
const row = (payload: object, timestamp: unknown = start, type = 'response_item') => ({ type, timestamp, payload });
const call = (callId = 'call', name: unknown = tool, type = 'function_call', timestamp: unknown = start) =>
  row({ type, call_id: callId, name, arguments: 'private input must not be returned' }, timestamp);
const output = (callId = 'call', value: unknown = { content: [], isError: false }, timestamp: unknown = finish,
  type = 'function_call_output') => row({ type, call_id: callId, output: value }, timestamp);
const invocation = { server: 'sample', tool: 'lookup', arguments: { private: 'do not retain' } };
const begin = (callId = 'call', timestamp: unknown = start, inv: unknown = invocation) =>
  row({ type: 'mcp_tool_call_begin', call_id: callId, invocation: inv }, timestamp, 'event_msg');
const end = (callId = 'call', result: unknown = { Ok: { content: [], isError: false } },
  duration: unknown = { secs: 0, nanos: 0 }, timestamp: unknown = finish, inv: unknown = invocation) =>
  row({ type: 'mcp_tool_call_end', call_id: callId, invocation: inv, result, duration }, timestamp, 'event_msg');

async function fixture(t: TestContext, files: unknown[][], withMeta = true) {
  const root = await mkdtemp(join(tmpdir(), 'agent-usage-mcp-'));
  t.after(async () => {
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.match(basename(root), /^agent-usage-mcp-/);
    await rm(root, { recursive: true, force: true });
  });
  for (const [index, rows] of files.entries()) {
    const dir = join(root, index % 2 ? 'archived_sessions' : 'sessions', 'nested');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${index}.jsonl`), [...(withMeta ? [meta()] : []), ...rows]
      .map(r => typeof r === 'string' ? r : JSON.stringify(r)).join('\n'));
  }
  return { root, scan: await collectMcpEvents(root) };
}

function unknownRecord(overrides: Partial<McpCallRecord> = {}): McpCallRecord {
  return { source: 'codex', sessionId: 'session', callId: 'call', server: null, tool, startedAt: start,
    status: 'unknown', finishedAt: null, durationMs: null, ...overrides } as McpCallRecord;
}
function knownRecord(overrides: Partial<McpCallRecord> = {}): McpCallRecord {
  return { ...unknownRecord(), status: 'succeeded', finishedAt: finish, durationMs: 0, ...overrides } as McpCallRecord;
}
function counts(invocations: number, succeeded: number, failed: number, unknown: number) {
  return { invocations, succeeded, failed, unknown };
}

test('empty/missing directories and history do not invent MCP calls', async t => {
  const { root, scan } = await fixture(t, []);
  assert.deepEqual(scan.events, []);
  assert.equal(scan.filesScanned, 0);
  assert.equal(scan.missingDirectories, 2);
  await writeFile(join(root, 'history.jsonl'), JSON.stringify(call()));
  assert.deepEqual(await collectMcpEvents(root), scan);
  assert.deepEqual(aggregateMcpEvents([]), { tools: [], totals: counts(0, 0, 0, 0) });
});

test('direct function and custom calls retain full tool and unknown server', async t => {
  const { scan } = await fixture(t, [[call(), call('custom', tool, 'custom_tool_call'),
    output(), output('custom', JSON.stringify({ content: [], isError: true }), finish, 'custom_tool_call_output')]]);
  assert.deepEqual(scan.events, [knownRecord({ durationMs: null }),
    knownRecord({ callId: 'custom', status: 'failed', durationMs: null })]);
  assert.equal(scan.filesScanned, 1);
  assert.equal(scan.filesRead, 1);
  assert.ok(!JSON.stringify(scan).includes('private'));
});

test('explicit lifecycle metadata maps server and preserves observed zero/fractional duration', async t => {
  const { scan } = await fixture(t, [[begin(), end(), begin('fractional'),
    end('fractional', { Ok: { content: [], isError: true } }, { secs: 2, nanos: 500_000 })]]);
  assert.deepEqual(scan.events, [knownRecord({ server: 'sample' }),
    knownRecord({ callId: 'fractional', server: 'sample', status: 'failed', durationMs: 2000.5 })]);
  const result = aggregateMcpEvents(scan.events);
  assert.deepEqual(result.totals, counts(2, 1, 1, 0));
  assert.equal(result.tools[0]?.durationSamples, 2);
  assert.equal(result.tools[0]?.totalDurationMs, 2000.5);
});

test('out-of-order results and metadata, cross-file replay and duplicate signals collapse by joint identity', async t => {
  const { scan } = await fixture(t, [[end(), output(), call(), begin(), call(), meta()],
    [meta(), begin(), call(), end(), output()]], false);
  assert.deepEqual(scan.events, [knownRecord({ server: 'sample' })]);
  assert.equal(scan.duplicateCalls, 4);
  assert.equal(scan.orphanResults, 0);
  assert.equal(scan.ambiguousResults, 0);
  const reversed = await fixture(t, [[meta(), output(), end(), call(), begin()],
    [meta(), call(), begin(), call(), output(), end()]], false);
  assert.deepEqual(reversed.scan.events, scan.events);
});

test('same callId in distinct sessions and separate calls in one second count independently', async t => {
  const { scan } = await fixture(t, [[meta('one'), call(), call('second'), output()],
    [meta('two'), call(), output('call', { content: [], isError: true })]], false);
  assert.equal(scan.events.length, 3);
  assert.deepEqual(aggregateMcpEvents(scan.events).totals, counts(3, 1, 1, 1));
});

test('a result in another session cannot complete a call; orphan results cannot create calls', async t => {
  const { scan } = await fixture(t, [[meta('one'), call()], [meta('two'), end(), output('ordinary')]], false);
  assert.deepEqual(scan.events, [unknownRecord({ sessionId: 'one' })]);
  assert.equal(scan.orphanResults, 1);
});

const uncertain: [string, unknown][] = [
  ['nonempty text', 'succeeded'], ['empty text', ''], ['missing flag', { content: [{ type: 'text', text: 'done' }] }],
  ['wrong flag type', { content: [], isError: 'false' }], ['missing content', { isError: false }],
  ['malformed JSON', '{"isError":false'], ['plain content array', [{ type: 'text', text: 'done' }]],
  ['timeout object', { status: 'timeout' }], ['cancelled object', { status: 'cancelled' }],
  ['blocked object', { status: 'blocked' }],
];
for (const [name, value] of uncertain) {
  test(`uncertain output stays unknown: ${name}`, async t => {
    const { scan } = await fixture(t, [[call(), output('call', value)]]);
    assert.deepEqual(scan.events, [unknownRecord()]);
    assert.equal(scan.ambiguousResults, 1);
  });
}

for (const value of [{ Err: 'cancelled' }, { Err: 'blocked' }, { Err: 'timeout' },
  { Err: 'transport unavailable' }, { Ok: { content: [] } },
  { Ok: { content: [], isError: false }, Err: 'conflict' }]) {
  test(`uncertain lifecycle result: ${JSON.stringify(value)}`, async t => {
    const { scan } = await fixture(t, [[begin(), end('call', value)]]);
    assert.deepEqual(scan.events, [unknownRecord({ server: 'sample' })]);
  });
}

test('missing results, invalid finish time, earlier finish, and conflicting statuses remain unknown', async t => {
  const { scan } = await fixture(t, [[call('missing'), call('bad-time'), output('bad-time', undefined, 'invalid'),
    call('earlier'), output('earlier', undefined, '2026-10-19T07:59:59Z'),
    call('conflict'), output('conflict'), output('conflict', { content: [], isError: true }),
    call('uncertain'), output('uncertain'), output('uncertain', 'cancelled')]]);
  assert.equal(scan.events.length, 5);
  assert.ok(scan.events.every(r => r.status === 'unknown' && r.finishedAt === null && r.durationMs === null));
  assert.equal(scan.ambiguousResults, 4);
  assert.equal(scan.invalidSignals, 1);
});

test('conflicting call metadata or result invocation cannot fabricate success', async t => {
  const { scan } = await fixture(t, [[call(), call('call', 'mcp__other__tool'), output(),
    begin('wrong-end'), end('wrong-end', undefined, undefined, finish, { server: 'other', tool: 'lookup', arguments: {} })]]);
  assert.equal(scan.conflictingCalls, 1);
  assert.equal(scan.ambiguousResults, 2);
  assert.ok(scan.events.every(r => r.status === 'unknown'));
});

for (const duration of [undefined, null, -1, 0, { secs: -1, nanos: 0 }, { secs: 0.5, nanos: 0 },
  { secs: 0, nanos: -1 }, { secs: 0, nanos: 1e9 }, { secs: 0, nanos: 0.1 }, { secs: '0', nanos: 0 }]) {
  test(`invalid or missing lifecycle duration ${JSON.stringify(duration)} stays null`, async t => {
    const value = duration === undefined ? {} : duration;
    const { scan } = await fixture(t, [[begin(), end('call', undefined, value)]]);
    assert.deepEqual(scan.events, [knownRecord({ server: 'sample', durationMs: null })]);
  });
}

test('conflicting durations lose only the sample; log timestamp differences are not duration', async t => {
  const { scan } = await fixture(t, [[begin(), end(), end('call', undefined, { secs: 1, nanos: 0 })]]);
  assert.deepEqual(scan.events, [knownRecord({ server: 'sample', durationMs: null })]);
  const result = aggregateMcpEvents(scan.events);
  assert.equal(result.tools[0]?.durationSamples, 0);
  assert.equal(result.tools[0]?.totalDurationMs, 0);
});

test('malformed lines, invalid calls, missing/ambiguous session metadata and unsupported tools', async t => {
  const { scan } = await fixture(t, [[meta(), '{bad', 'null', '', call(), output(),
    call('bad-time', tool, 'function_call', '2026-02-30T00:00:00Z'),
    call('local-time', tool, 'function_call', '2026-10-19T08:00:00'), call('', tool),
    call('ordinary', 'exec'), call('malformed', 42),
    row({ type: 'function_call', call_id: 'nested', name: 'exec', arguments: JSON.stringify({ name: tool }) }),
    row({ type: 'mcp_tool_call_begin', call_id: 'bad-map', invocation: {} }, start, 'event_msg')],
    [call('no-meta'), output('no-meta')], [meta('one'), meta('two'), call('two-metas')]], false);
  assert.deepEqual(scan.events, [knownRecord({ durationMs: null })]);
  assert.equal(scan.malformedLines, 2);
  assert.equal(scan.invalidSignals, 4);
  assert.equal(scan.missingSessionFiles, 2);
  assert.equal(scan.filesScanned, 3);
  assert.equal(scan.filesRead, 3);
});

test('non-directory scan roots are visible as errors, not missing directories', async t => {
  const { root } = await fixture(t, []);
  await writeFile(join(root, 'sessions'), 'synthetic');
  const scan = await collectMcpEvents(root);
  assert.equal(scan.directoryErrors, 1);
  assert.equal(scan.missingDirectories, 1);
});

test('timestamp parser rejects invalid calendar/time values and normalizes offsets', () => {
  assert.equal(parseMcpTimestamp('2026-10-19T16:00:00+08:00'), start);
  assert.equal(parseMcpTimestamp('2024-02-29T00:00:00Z'), '2024-02-29T00:00:00.000Z');
  for (const value of ['2026-02-29T00:00:00Z', '2026-04-31T00:00:00Z', '2026-00-01T00:00:00Z',
    '2026-01-00T00:00:00Z', '2026-10-19T24:00:00Z', '2026-10-19T08:60:00Z', '2026-10-19T08:00:60Z',
    '2026-10-19T08:00:00', 'junk', 0, null]) assert.equal(parseMcpTimestamp(value), null);
});

test('aggregate identity keys resist separator collisions, deduplicate snapshots, and preserve input', () => {
  const records = [unknownRecord(), knownRecord(), knownRecord(),
    unknownRecord({ sessionId: 'a|b', callId: 'c' }), unknownRecord({ sessionId: 'a', callId: 'b|c' }),
    unknownRecord({ sessionId: 'other' })];
  const copy = structuredClone(records);
  const result = aggregateMcpEvents(records);
  assert.deepEqual(records, copy);
  assert.deepEqual(result.totals, counts(4, 1, 0, 3));
  assert.equal(result.tools[0]?.durationSamples, 1);
  assert.equal(result.tools[0]?.totalDurationMs, 0);
  assert.equal(result.tools[0]?.lastUsedAt, start);
  assert.deepEqual(aggregateMcpEvents([...records].reverse()), result);
});

test('aggregate groups server/tool separately with deterministic ranking and latest start', () => {
  const later = '2026-10-19T09:00:00Z';
  const result = aggregateMcpEvents([
    unknownRecord(), knownRecord({ callId: 'two', startedAt: later, finishedAt: later, durationMs: 4 }),
    knownRecord({ callId: 'three', server: 'sample', status: 'failed', durationMs: null }),
    unknownRecord({ callId: 'four', tool: 'mcp__another__tool' }),
  ]);
  assert.deepEqual(result.totals, counts(4, 1, 1, 2));
  assert.deepEqual(result.tools.map(r => [r.server, r.tool, r.invocations]), [
    [null, tool, 2], [null, 'mcp__another__tool', 1], ['sample', tool, 1],
  ]);
  assert.equal(result.tools[0]?.lastUsedAt, '2026-10-19T09:00:00.000Z');
  for (const stats of result.tools) assert.equal(stats.invocations, stats.succeeded + stats.failed + stats.unknown);
});

test('aggregate merges explicit server, downgrades conflicts, and drops conflicting duration samples', () => {
  assert.equal(aggregateMcpEvents([unknownRecord(), knownRecord({ server: 'sample' })]).tools[0]?.server, 'sample');
  for (const conflict of [knownRecord({ status: 'failed' }), knownRecord({ tool: 'mcp__other__tool' })]) {
    const result = aggregateMcpEvents([knownRecord(), conflict]);
    assert.deepEqual(result.totals, counts(1, 0, 0, 1));
    assert.deepEqual(aggregateMcpEvents([conflict, knownRecord()]), result);
  }
  const conflict = aggregateMcpEvents([knownRecord({ server: 'one' }), knownRecord({ server: 'two' })]);
  assert.equal(conflict.tools[0]?.server, null);
  assert.equal(conflict.totals.unknown, 1);
  const durationConflict = aggregateMcpEvents([knownRecord(), knownRecord({ durationMs: 3 })]);
  assert.equal(durationConflict.totals.succeeded, 1);
  assert.equal(durationConflict.tools[0]?.durationSamples, 0);
});

test('aggregate rolling cutoff is inclusive, based on earliest call start after identity merge', t => {
  const now = Date.parse('2026-10-20T08:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const records = [unknownRecord(), unknownRecord({ callId: 'old', startedAt: '2026-10-19T07:59:59.999Z' }),
    unknownRecord({ callId: 'latest', startedAt: '2026-10-20T07:00:00Z' })];
  assert.equal(aggregateMcpEvents(records, { days: 1 }).totals.invocations, 2);
  assert.equal(aggregateMcpEvents(records, { days: 0.5 }).totals.invocations, 1);
  assert.equal(aggregateMcpEvents(records).totals.invocations, 3);
  assert.equal(aggregateMcpEvents([unknownRecord({ startedAt: '2026-10-19T07:59:59Z' }),
    knownRecord()], { days: 1 }).totals.invocations, 0);
  for (const days of [0, -1, NaN, Infinity, -Infinity]) assert.throws(() => aggregateMcpEvents([], { days }), RangeError);
});

test('aggregate rejects contract violations, invalid durations, and duration sum overflow', () => {
  const invalid = [unknownRecord({ sessionId: '' }), unknownRecord({ callId: '' }), unknownRecord({ tool: ' ' }),
    unknownRecord({ server: '' }), unknownRecord({ startedAt: 'invalid' }),
    unknownRecord({ finishedAt: finish }), unknownRecord({ durationMs: 0 }),
    knownRecord({ finishedAt: '2026-10-19T07:00:00Z' }), knownRecord({ durationMs: -1 }),
    knownRecord({ durationMs: NaN }), knownRecord({ durationMs: Infinity }),
    { ...knownRecord(), source: 'other' }, { ...knownRecord(), status: 'cancelled' },
  ];
  for (const value of invalid) assert.throws(() => aggregateMcpEvents([value as McpCallRecord]), TypeError);
  assert.throws(() => aggregateMcpEvents([knownRecord({ durationMs: Number.MAX_VALUE }),
    knownRecord({ callId: 'other', durationMs: Number.MAX_VALUE })]), RangeError);
});
