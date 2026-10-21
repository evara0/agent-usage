import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

function run(args, ok = true) {
  const r = spawnSync(process.execPath, ['dist/index.mjs', ...args], { encoding: 'utf8' });
  assert.ifError(r.error);
  if (ok) { assert.equal(r.status, 0, r.stderr); assert.equal(r.stderr, ''); }
  else { assert.notEqual(r.status, 0); assert.equal(r.stdout, ''); assert.ok(r.stderr.trim()); }
  return r;
}
async function fixture(t, imports = true) {
  const root = await mkdtemp(join(tmpdir(), 'agent-usage-hooks-cli-'));
  t.after(async () => {
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.match(basename(root), /^agent-usage-hooks-cli-/);
    await rm(root, { recursive: true, force: true });
  });
  const timestamp = Date.now() - 60_000;
  const signal = (id, patch = {}) => ({ method: 'hook/completed', params: { threadId: 'synthetic-cli', run: {
    id, eventName: 'postToolUse', handlerType: 'command', executionMode: 'sync', source: 'user',
    sourcePath: '/PRIVATE_PATH/hooks.json', displayOrder: 0, startedAt: timestamp, completedAt: timestamp + 1,
    status: 'completed', durationMs: 0, entries: [{ text: 'SECRET_BODY_中文' }], command: 'SECRET_COMMAND', ...patch,
  } } });
  if (imports) {
    await mkdir(join(root, 'usage-hooks'));
    await writeFile(join(root, 'usage-hooks', 'fixture.jsonl'), [
      { type: 'agent_usage_hook_import', schemaVersion: 1, timestampUnit: 'unix-ms' },
      signal('ok'), signal('ok'), signal('fail', { status: 'failed', durationMs: 5 }),
      signal('unknown', { eventName: 'stop', status: 'blocked', durationMs: null }),
      signal('old', { eventName: 'sessionStart', startedAt: timestamp - 90 * 86400000,
        completedAt: timestamp - 90 * 86400000 + 1 }), '{bad',
    ].map(r => typeof r === 'string' ? r : JSON.stringify(r)).join('\n'));
  }
  await writeFile(join(root, 'hooks.json'), JSON.stringify({ hooks: { Stop: [{ command: 'SECRET_COMMAND' }] } }));
  await mkdir(join(root, 'sessions'));
  await writeFile(join(root, 'sessions', 'skills.jsonl'), [
    { type: 'session_meta', payload: { id: 'skill-cli', cwd: '/synthetic' } },
    { type: 'event_msg', timestamp: new Date(timestamp).toISOString(), payload: { type: 'user_message', message: '$existing-skill' } },
  ].map(r => JSON.stringify(r)).join('\n'));
  return root;
}

test('Hook JSON independently routes, keeps all groups under limit and strips sensitive data', async t => {
  const root = await fixture(t);
  const text = run(['--hooks', '--codex-dir', root, '--days', '30', '--limit', '1', '--json']).stdout;
  const report = JSON.parse(text);
  assert.equal(report.kind, 'hooks');
  assert.equal(report.source, 'codex');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.windowDays, 30);
  assert.equal(report.hooks.length, 2);
  assert.deepEqual(report.totals, { invocations: 3, succeeded: 1, failed: 1, unknown: 1 });
  assert.equal(report.scan.duplicateSignals, 1);
  assert.equal(report.scan.malformedLines, 1);
  assert.equal(report.scan.completedSignals, 5);
  assert.equal(report.coverage.nativePersistenceVerified, false);
  assert.equal(report.coverage.asyncCovered, false);
  assert.doesNotMatch(text, /SECRET_|PRIVATE_|existing-skill|synthetic-cli|"records"/);
});

test('Hook table limit only hides rows, with observed samples and full quality/coverage', async t => {
  const root = await fixture(t);
  const text = run(['--hooks', '--codex-dir', root, '-d', '30', '-l', '1']).stdout;
  assert.match(text, /3 Hook calls/);
  assert.match(text, /1 more hooks/);
  assert.match(text, /2\.50/);
  assert.match(text, /malformedLines=1/);
  assert.match(text, /not a Codex native log directory/);
  assert.doesNotMatch(run(['--hooks', '--codex-dir', root, '-l', '0']).stdout, /more hooks/);
});

test('native config and sessions without imported evidence yield empty explanatory output', async t => {
  const root = await fixture(t, false);
  const report = JSON.parse(run(['--hooks', '--json', '--codex-dir', root]).stdout);
  assert.deepEqual(report.hooks, []);
  assert.equal(report.totals.invocations, 0);
  assert.equal(report.scan.filesScanned, 0);
  assert.equal(report.scan.missingDirectories, 1);
  assert.equal(report.coverage.availability, 'no-imports');
  assert.match(run(['--hooks', '--codex-dir', root]).stdout, /not proof that no Hooks ran/);
  const skill = JSON.parse(run(['--json', '--codex-dir', root]).stdout);
  assert.ok(skill.skills.some(s => s.skill === 'existing-skill'));
  const mcp = JSON.parse(run(['--mcp', '--json', '--codex-dir', root]).stdout);
  assert.equal(mcp.kind, 'mcp');
  assert.equal(mcp.totals.invocations, 0);
});

test('Hook mode rejects conflicting and invalid options before any output is written', async t => {
  const root = await fixture(t);
  const output = join(root, 'should-not-exist.json');
  for (const args of [['--mcp'], ['--strict'], ['--markdown'], ['--days', '0'], ['--days', 'NaN'],
    ['--limit', '-1'], ['--limit', '1.5'], ['--unknown-hook-option']]) {
    run(['--hooks', '--codex-dir', root, '--json', '--output', output, ...args], false);
    await assert.rejects(access(output));
  }
  run(['--hooks', '--output', output], false);
});

test('Hook export directly writes complete BOM-free UTF-8 JSON and overwrites', async t => {
  const root = await fixture(t);
  const output = join(root, '导出', '统计.json');
  assert.equal(run(['--hooks', '--json', '--limit', '1', '--codex-dir', root, '--output', output]).stdout, '');
  const bytes = await readFile(output);
  assert.notDeepEqual([...bytes.subarray(0, 3)], [239, 187, 191]);
  assert.deepEqual(Buffer.from(bytes.toString('utf8'), 'utf8'), bytes);
  assert.match(bytes.toString('utf8'), /配置存在不能证明 Hook 运行/);
  assert.equal(JSON.parse(bytes.toString('utf8')).hooks.length, 3);
  await writeFile(output, 'obsolete');
  run(['--hooks', '--json', '--days', '30', '--codex-dir', root, '--output', output]);
  assert.equal(JSON.parse(await readFile(output, 'utf8')).hooks.length, 2);
});

test('help explains offline Hook mode', () => {
  assert.match(run(['--help']).stdout, /--hooks/);
  assert.match(run(['--help']).stdout, /offline Hook/i);
});
