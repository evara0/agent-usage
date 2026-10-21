import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { collectHookEvents } from '../src/adapters/hooks.js';
import { aggregateHookEvents } from '../src/hooks-aggregate.js';
import type { HookRecord } from '../src/hooks-types.js';

const time = Date.parse('2026-10-20T00:00:00.000Z');
const header = { type: 'agent_usage_hook_import', schemaVersion: 1, timestampUnit: 'unix-ms' };
function signal(phase: 'started' | 'completed', id: string, patch: Record<string, unknown> = {}, thread = 'synthetic-thread') {
  return { method: `hook/${phase}`, params: { threadId: thread, turnId: 'synthetic-turn', run: {
    id, eventName: 'postToolUse', handlerType: 'command', executionMode: 'sync', scope: 'turn',
    source: 'project', sourcePath: '/SENSITIVE_CONFIG_PATH/hooks.json', displayOrder: 0,
    startedAt: time, completedAt: phase === 'completed' ? time + 5 : null,
    status: phase === 'completed' ? 'completed' : 'running', durationMs: phase === 'completed' ? 0 : null,
    entries: [{ kind: 'error', text: 'PRIVATE_OUTPUT_SECRET' }], statusMessage: 'PRIVATE_MESSAGE',
    command: 'PRIVATE_COMMAND', ...patch,
  } } };
}
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'agent-usage-hooks-'));
  t.after(async () => {
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.match(basename(root), /^agent-usage-hooks-/);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'usage-hooks'));
  return { root, write: async (name: string, rows: unknown[], withHeader = true) => {
    await writeFile(join(root, 'usage-hooks', name), [...(withHeader ? [header] : []), ...rows]
      .map(r => typeof r === 'string' ? r : JSON.stringify(r)).join('\n'), 'utf8');
  } };
}

test('explicit summaries correlate across files, replay and order; no sensitive fields retained', async t => {
  const f = await fixture(t);
  await f.write('a.jsonl', [signal('completed', 'a'), signal('started', 'a')]);
  await f.write('b.jsonl', [signal('started', 'a'), signal('completed', 'a'), signal('completed', 'a', {}, 'other-thread')]);
  const result = await collectHookEvents(f.root);
  assert.equal(result.records.length, 2);
  assert.equal(result.scan.duplicateSignals, 2);
  assert.equal(result.scan.completionOnlyRuns, 1);
  assert.equal(result.scan.filesRead, 2);
  assert.ok(result.records.every(r => r.status === 'succeeded' && r.durationMs === 0));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|SENSITIVE_|synthetic-thread|other-thread/);
  assert.deepEqual(Object.keys(result.records[0]!).sort(), ['source', 'identity', 'hookId', 'event', 'configSource',
    'handler', 'startedAt', 'finishedAt', 'status', 'durationMs'].sort());
  assert.deepEqual(aggregateHookEvents(result.records).totals, { invocations: 2, succeeded: 2, failed: 0, unknown: 0 });
});

test('configuration, tools, stdout and aggregate telemetry never manufacture runs', async t => {
  const f = await fixture(t);
  const config = { hooks: { PostToolUse: [{ hooks: [{ command: 'PRIVATE_COMMAND', enabled: true }] }] } };
  await writeFile(join(f.root, 'hooks.json'), JSON.stringify(config));
  await mkdir(join(f.root, 'sessions'));
  await writeFile(join(f.root, 'sessions', 'real-layout.jsonl'), JSON.stringify(signal('started', 'ignored')));
  await f.write('noise.jsonl', [config, { method: 'hooks/list', result: { enabled: true, trusted: true } },
    { type: 'response_item', payload: { type: 'function_call_output', output: 'success', call_id: 'a' } },
    { name: 'codex.hooks.run', count: 100, status: 'completed' }, { method: 'hook/future' }]);
  const result = await collectHookEvents(f.root);
  assert.equal(result.records.length, 0);
  assert.equal(result.scan.filesScanned, 1);
  assert.equal(result.scan.unsupportedSignals, 1);
  assert.equal(result.coverage.nativePersistenceVerified, false);
});

test('missing completion, cancellation, blocking and explicit failure remain distinct', async t => {
  const f = await fixture(t);
  await f.write('runs.jsonl', [signal('started', 'missing'),
    signal('completed', 'blocked', { status: 'blocked', durationMs: 8 }),
    signal('completed', 'stopped', { status: 'stopped', durationMs: null }),
    signal('completed', 'failure', { status: 'failed', durationMs: 4 }),
    signal('completed', 'text', { status: 'cancelled', entries: [{ text: 'success' }] }),
    signal('completed', 'missing-time', { completedAt: null })]);
  const result = await collectHookEvents(f.root);
  assert.equal(result.scan.missingResults, 1);
  assert.equal(result.scan.ambiguousResults, 2);
  assert.equal(result.records.filter(r => r.status === 'unknown').length, 5);
  assert.equal(result.records.filter(r => r.status === 'failed').length, 1);
  assert.ok(result.records.some(r => r.status === 'unknown' && r.durationMs === 8 && r.finishedAt !== null));
  assert.deepEqual(aggregateHookEvents(result.records).totals, { invocations: 6, succeeded: 0, failed: 1, unknown: 5 });
});

test('identity, start time, terminal and end time conflicts are conservative and deterministic', async t => {
  const f = await fixture(t);
  const rows = [
    signal('started', 'identity'), signal('completed', 'identity', { sourcePath: '/other/hooks.json' }),
    signal('started', 'start'), signal('completed', 'start', { startedAt: time + 1 }),
    signal('completed', 'terminal'), signal('completed', 'terminal', { status: 'failed' }),
    signal('completed', 'end'), signal('completed', 'end', { completedAt: time + 6 }),
    signal('completed', 'backwards', { completedAt: time - 1 }),
  ];
  await f.write('runs.jsonl', rows);
  const a = await collectHookEvents(f.root);
  await f.write('runs.jsonl', [...rows].reverse());
  const b = await collectHookEvents(f.root);
  assert.deepEqual(a, b);
  assert.equal(a.scan.conflictingRuns, 2);
  assert.equal(a.scan.ambiguousResults, 5);
  assert.ok(a.records.every(r => r.status === 'unknown' && r.durationMs === null));
});

test('zero, missing, invalid and conflicting measured durations differ from elapsed timestamps', async t => {
  const f = await fixture(t);
  await f.write('runs.jsonl', [signal('completed', 'zero'), signal('completed', 'missing', { durationMs: null }),
    signal('completed', 'invalid', { durationMs: -1 }), signal('completed', 'fraction', { durationMs: 0.5 }),
    signal('completed', 'conflict', { durationMs: 1 }), signal('completed', 'conflict', { durationMs: 2 })]);
  const result = await collectHookEvents(f.root);
  assert.equal(result.scan.invalidDurations, 2);
  assert.equal(result.scan.conflictingDurations, 1);
  assert.ok(result.records.every(r => r.status === 'succeeded'));
  const stats = aggregateHookEvents(result.records).hooks[0]!;
  assert.equal(stats.invocations, 5);
  assert.equal(stats.durationSamples, 1);
  assert.equal(stats.totalDurationMs, 0);
});

test('schema/unit declarations, damaged data and unsupported handlers expose quality', async t => {
  const f = await fixture(t);
  await f.write('undeclared.jsonl', [signal('started', 'no-header')], false);
  await f.write('bad-header.jsonl', [{ ...header, timestampUnit: 'guess' }, signal('started', 'bad-header')], false);
  await f.write('empty.jsonl', [], false);
  await f.write('valid.jsonl', ['{bad', [], signal('started', 'async', { executionMode: 'async' }),
    signal('started', 'prompt', { handlerType: 'prompt' }), signal('started', 'agent', { handlerType: 'agent' }),
    signal('started', 'bad-time', { startedAt: Number.MAX_SAFE_INTEGER }),
    signal('started', 'bad-source', { source: 'PRIVATE_SOURCE' }), signal('started', 'bad-path', { sourcePath: 'relative' }),
    signal('started', '', {}), signal('started', 'valid')]);
  const result = await collectHookEvents(f.root);
  assert.equal(result.scan.filesScanned, 4);
  assert.equal(result.scan.filesRead, 4);
  assert.equal(result.scan.unsupportedFiles, 3);
  assert.equal(result.scan.malformedLines, 2);
  assert.equal(result.scan.unsupportedSignals, 3);
  assert.equal(result.scan.invalidSignals, 4);
  assert.equal(result.records.length, 1);
});

test('declared seconds and milliseconds normalize consistently; source and event split grouping', async t => {
  const f = await fixture(t);
  await f.write('seconds.jsonl', [{ ...header, timestampUnit: 'unix-s' }, signal('completed', 'seconds', {
    startedAt: time / 1000, completedAt: time / 1000 + 1, durationMs: 100,
  })], false);
  await f.write('milliseconds.jsonl', [signal('completed', 'milliseconds'),
    signal('completed', 'event', { eventName: 'stop' }),
    signal('completed', 'source', { source: 'plugin' }),
    signal('completed', 'handler', { handlerType: 'mcpTool' }),
    signal('completed', 'order', { displayOrder: 1 })]);
  const result = await collectHookEvents(f.root);
  assert.equal(new Set(result.records.map(r => r.startedAt)).size, 1);
  assert.equal(aggregateHookEvents(result.records).hooks.length, 5);
});

test('missing import directory and directory errors return empty coverage', async t => {
  const f = await fixture(t);
  await rmdir(join(f.root, 'usage-hooks'));
  const missing = await collectHookEvents(f.root);
  assert.equal(missing.coverage.availability, 'no-imports');
  assert.equal(missing.scan.missingDirectories, 1);
  await writeFile(join(f.root, 'usage-hooks'), 'not a directory');
  const error = await collectHookEvents(f.root);
  assert.equal(error.scan.directoryErrors, 1);
  assert.equal(error.scan.missingDirectories, 0);
  assert.equal(error.records.length, 0);
});

const record = (patch: Partial<HookRecord> = {}): HookRecord => ({
  source: 'codex', identity: 'a'.repeat(64), hookId: 'b'.repeat(64), event: 'stop', configSource: 'user',
  handler: 'command', startedAt: '2026-10-20T00:00:00.000Z', finishedAt: null, status: 'unknown', durationMs: null, ...patch,
});

test('aggregation merges snapshots before inclusive rolling window and preserves inputs', t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-10-21T00:00:00.000Z'));
  const finished = record({ status: 'succeeded', finishedAt: '2026-10-20T00:00:00.100Z', durationMs: 0 });
  const rows = [record(), finished, finished, record({ identity: 'c'.repeat(64), startedAt: '2026-10-19T23:59:59.999Z' })];
  const before = structuredClone(rows);
  const result = aggregateHookEvents(rows, { days: 1 });
  assert.deepEqual(result.totals, { invocations: 1, succeeded: 1, failed: 0, unknown: 0 });
  assert.equal(result.hooks[0]!.durationSamples, 1);
  assert.deepEqual(rows, before);
  const conflict = aggregateHookEvents([finished, { ...finished, status: 'failed' }]);
  assert.equal(conflict.totals.unknown, 1);
  assert.equal(conflict.hooks[0]!.durationSamples, 0);
  assert.deepEqual(aggregateHookEvents([...rows].reverse(), { days: 1 }), result);
  const metadataConflict = [finished, { ...finished, event: 'postToolUse' as const }];
  const conflicted = aggregateHookEvents(metadataConflict);
  assert.equal(conflicted.totals.unknown, 1);
  assert.deepEqual(aggregateHookEvents([...metadataConflict].reverse()), conflicted);
});

test('aggregation validates contracts, duration overflow and options', () => {
  for (const days of [0, -1, NaN, Infinity]) assert.throws(() => aggregateHookEvents([], { days }), RangeError);
  for (const patch of [{ identity: 'raw' }, { startedAt: '2026-02-30' }, { durationMs: 0 },
    { status: 'succeeded' }, { event: 'PRIVATE_EVENT' }, { finishedAt: '2026-10-19T00:00:00.000Z' }]) {
    assert.throws(() => aggregateHookEvents([record(patch as Partial<HookRecord>)]), TypeError);
  }
  const big = record({ status: 'succeeded', finishedAt: '2026-10-20T00:00:01.000Z', durationMs: Number.MAX_SAFE_INTEGER });
  assert.throws(() => aggregateHookEvents([big, { ...big, identity: 'c'.repeat(64) }]), RangeError);
  assert.deepEqual(aggregateHookEvents([]), { hooks: [], totals: { invocations: 0, succeeded: 0, failed: 0, unknown: 0 } });
});
