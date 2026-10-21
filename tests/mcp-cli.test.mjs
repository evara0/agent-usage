import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

function run(args, ok = true) {
  const result = spawnSync(process.execPath, ['dist/index.mjs', ...args], { encoding: 'utf8' });
  assert.ifError(result.error);
  if (ok) {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
  } else {
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.trim());
  }
  return result.stdout;
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'agent-usage-mcp-cli-'));
  t.after(async () => {
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.match(basename(root), /^agent-usage-mcp-cli-/);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'sessions'));
  await mkdir(join(root, 'archived_sessions'));
  const timestamp = new Date(Date.now() - 60_000).toISOString();
  const old = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const meta = { type: 'session_meta', payload: { id: 'synthetic-mcp-cli' } };
  const call = (callId, name, time = timestamp) => ({ type: 'response_item', timestamp: time,
    payload: { type: 'function_call', call_id: callId, name, arguments: 'PRIVATE_ARGUMENT_SENTINEL' } });
  const output = (callId, isError, time = timestamp) => ({ type: 'response_item', timestamp: time,
    payload: { type: 'function_call_output', call_id: callId,
      output: { content: [{ type: 'text', text: 'PRIVATE_RESULT_SENTINEL' }], isError } } });
  const invocation = { server: 'demo', tool: 'timed' };
  const write = async (file, rows) => writeFile(file, rows.map(row => typeof row === 'string' ? row : JSON.stringify(row)).join('\n'));
  await write(join(root, 'sessions', 'calls.jsonl'), [meta,
    call('ok', 'mcp__demo__lookup'), output('ok', false),
    call('fail', 'mcp__demo__lookup'), output('fail', true),
    call('unknown', 'mcp__demo__unknown'), call('old', 'mcp__demo__old', old), output('old', false, old),
    { type: 'event_msg', timestamp, payload: { type: 'mcp_tool_call_begin', call_id: 'timed', invocation } },
    { type: 'event_msg', timestamp, payload: { type: 'mcp_tool_call_end', call_id: 'timed', invocation,
      result: { Ok: { content: [], isError: false } }, duration: { secs: 0, nanos: 0 } } },
    { type: 'event_msg', timestamp, payload: { type: 'user_message', message: '$only-skill' } },
    '{broken JSON',
  ]);
  await write(join(root, 'archived_sessions', 'replay.jsonl'), [meta, call('ok', 'mcp__demo__lookup'), output('ok', false)]);
  return root;
}

test('MCP JSON routes independently, deduplicates replay, keeps unknown and strips private data', async t => {
  const root = await fixture(t);
  const text = run(['--codex-dir', root, '--mcp', '--json', '--days', '30', '--limit', '1']);
  const report = JSON.parse(text);
  assert.deepEqual(Object.keys(report).sort(), [
    'schemaVersion', 'generatedAt', 'source', 'kind', 'windowDays', 'elapsedMs', 'scan', 'totals', 'tools',
  ].sort());
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.kind, 'mcp');
  assert.equal(report.source, 'codex');
  assert.equal(report.windowDays, 30);
  assert.deepEqual(report.totals, { invocations: 4, succeeded: 2, failed: 1, unknown: 1 });
  assert.equal(report.tools.length, 3);
  assert.equal(report.scan.filesRead, 2);
  assert.equal(report.scan.filesScanned, 2);
  assert.equal(report.scan.duplicateCalls, 1);
  assert.equal(report.scan.malformedLines, 1);
  assert.ok(!('events' in report.scan));
  assert.doesNotMatch(text, /PRIVATE_|only-skill/);
  const timed = report.tools.find(tool => tool.server === 'demo');
  assert.equal(timed.durationSamples, 1);
  assert.equal(timed.totalDurationMs, 0);
  const lookup = report.tools.find(tool => tool.tool === 'mcp__demo__lookup');
  assert.equal(lookup.server, null);
  assert.equal(lookup.durationSamples, 0);
});

test('MCP table limits only rows and displays full totals and scan diagnostics', async t => {
  const root = await fixture(t);
  const text = run(['--codex-dir', root, '--mcp', '-d', '30', '-l', '1']);
  assert.match(text, /4 MCP calls · 2 succeeded \/ 1 failed \/ 1 unknown/);
  assert.match(text, /2 more tools/);
  assert.match(text, /malformedLines=1/);
  assert.match(text, /Avg ms/);
  assert.match(text, /observed duration samples only/);
  assert.doesNotMatch(run(['--codex-dir', root, '--mcp', '-l', '0']), /more tools/);
});

test('MCP all-history, missing data and scan errors stay distinguishable', async t => {
  const root = await fixture(t);
  const all = JSON.parse(run(['--codex-dir', root, '--mcp', '--json']));
  assert.equal(all.windowDays, null);
  assert.equal(all.totals.invocations, 5);
  const empty = JSON.parse(run(['--codex-dir', join(root, 'missing'), '--mcp', '--json']));
  assert.equal(empty.totals.invocations, 0);
  assert.equal(empty.scan.filesScanned, 0);
  assert.equal(empty.scan.missingDirectories, 2);
  const brokenRoot = join(root, 'broken-root');
  await mkdir(brokenRoot);
  await writeFile(join(brokenRoot, 'sessions'), 'synthetic');
  await mkdir(join(brokenRoot, 'archived_sessions'));
  const scanError = JSON.parse(run(['--codex-dir', brokenRoot, '--mcp', '--json']));
  assert.equal(scanError.scan.directoryErrors, 1);
  assert.equal(scanError.scan.missingDirectories, 0);
});

test('Skill JSON and Markdown still work on a dataset containing MCP calls', async t => {
  const root = await fixture(t);
  const skill = JSON.parse(run(['--codex-dir', root, '--json']));
  assert.equal(skill.totals.invocations, 1);
  assert.equal(skill.skills[0].skill, 'only-skill');
  assert.ok(!('kind' in skill));
  assert.ok(!('tools' in skill));
  const markdown = run(['--codex-dir', root, '--markdown']);
  assert.ok(markdown.startsWith('# Codex Skill 使用报告\n'));
  assert.match(markdown, /only-skill/);
  assert.doesNotMatch(markdown, /mcp__demo/);
});

test('MCP JSON exports directly as UTF-8 without stdout', async t => {
  const root = await fixture(t);
  const target = join(root, '导出', 'mcp.json');
  assert.equal(run(['--codex-dir', root, '--mcp', '--json', '--output', target]), '');
  const report = JSON.parse(await readFile(target, 'utf8'));
  assert.equal(report.kind, 'mcp');
  assert.equal(report.totals.invocations, 5);
});

for (const args of [
  ['--mcp', '--strict'], ['--mcp', '--markdown'], ['--mcp', '--markdown', '--json'],
  ['--mcp', '--unknown'], ['--mcp', '--days', 'NaN'],
]) {
  test(`MCP rejects incompatible or invalid arguments before scanning: ${args.join(' ')}`, () => run(args, false));
}
