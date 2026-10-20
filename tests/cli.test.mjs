import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

function run(args, ok = true) {
  const result = spawnSync(process.execPath, ['dist/index.mjs', ...args], { encoding: 'utf8' });
  assert.ifError(result.error);
  if (ok) assert.equal(result.status, 0, result.stderr);
  else {
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '', 'invalid arguments must not produce scan output');
    assert.ok(result.stderr.trim(), 'invalid arguments must explain the error');
  }
  return result.stdout;
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'agent-usage-cli-'));
  t.after(async () => {
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.match(basename(root), /^agent-usage-cli-/);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'sessions'));
  const timestamp = new Date().toISOString();
  const read = skill => ({ type: 'response_item', timestamp, payload: {
    type: 'custom_tool_call', name: 'exec',
    input: `text(await tools.exec_command({cmd: ${JSON.stringify(`Get-Content 'C:/demo/skills/.system/${skill}/SKILL.md'`)}}));`,
  }});
  const manual = { type: 'event_msg', timestamp, payload: { type: 'user_message', message: '$explicit' }};
  await writeFile(join(root, 'sessions', 'test.jsonl'), [
    { type: 'session_meta', payload: { id: 'synthetic-cli', cwd: 'C:/demo' } },
    read('sample'), read('second'), manual, read('explicit'),
  ].map(JSON.stringify).join('\n'));
  return root;
}

for (const strict of [false, true]) {
  test(`JSON contract, strict=${strict}`, async t => {
    const root = await fixture(t);
    const result = JSON.parse(run(['--codex-dir', root, '--json', ...(strict ? ['--strict'] : [])]));
    assert.equal(result.source, 'codex');
    assert.equal(result.windowDays, null);
    assert.equal(result.totals.invocations, strict ? 1 : 3);
    assert.equal(result.totals.manual, 1);
    assert.ok(result.elapsedMs >= 0);
    for (const skill of result.skills) {
      assert.ok(Object.keys(skill.daily).length);
      assert.equal(skill.projects['C:/demo'], 1);
      assert.deepEqual(skill.aliases, [skill.skill]);
      assert.equal(skill.total, skill.manual + skill.auto);
      if (strict) assert.equal(skill.inferredAuto, 0);
    }
  });
}

test('table evidence, totals and row limit; JSON stays complete', async t => {
  const root = await fixture(t);
  const output = run(['--codex-dir', root, '-l', '1']);
  assert.match(output, /Explicit/);
  assert.match(output, /Inferred/);
  assert.match(output, /Last recorded/);
  assert.match(output, /3 records · 1 explicit \/ 2 inferred/);
  assert.match(output, /2 more skills/);
  assert.doesNotMatch(output, /Manual|Trend/);
  const json = JSON.parse(run(['--codex-dir', root, '--json', '-l', '1', '-d', '30']));
  assert.equal(json.skills.length, 3);
  assert.equal(json.windowDays, 30);
  assert.doesNotMatch(run(['--codex-dir', root, '-l', '0']), /more skills/);
});

test('missing Codex home returns empty JSON', async t => {
  const root = await fixture(t);
  const result = JSON.parse(run(['--codex-dir', join(root, 'missing'), '--json']));
  assert.equal(result.totals.invocations, 0);
  assert.equal(result.filesScanned, 1);
});

for (const args of [['--help'], ['--help', '--json'], ['-h']]) {
  test(`help ${args.join(' ')}`, () => {
    const output = run(args);
    assert.match(output, /Codex Skill/);
    assert.match(output, /--codex-dir/);
    assert.doesNotMatch(output, /--source|--claude-dir|--include-subagents|daily/);
  });
}
for (const flag of ['--version', '-v']) {
  test(`version ${flag}`, () => assert.equal(run([flag, '--json']).trim(), '0.1.0'));
}
for (const args of [
  ['daily'], ['--source', 'codex'], ['--claude-dir', 'unused'], ['--include-subagents'],
  ['--unknown'], ['--days', '0'], ['--days', '-1'], ['--days', 'Infinity'], ['--days', 'NaN'],
  ['--limit', 'NaN'], ['--limit='], ['--days='], ['--codex-dir'], ['--unknown', '--help'],
  ['--limit', '-1'], ['--limit', '1.5'], ['--limit', 'Infinity'],
]) {
  test(`reject ${args.join(' ')}`, () => run([...args, '--json'], false));
}
