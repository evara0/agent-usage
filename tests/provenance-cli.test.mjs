import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

function run(args, success = true) {
  const result = spawnSync(process.execPath, ['dist/index.mjs', ...args], { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status === 0, success, result.stderr);
  if (!success) assert.equal(result.stdout, '');
  return result;
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'agent-usage-provenance-cli-'));
  t.after(async () => {
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.match(basename(root), /^agent-usage-provenance-cli-/);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'sessions'));
  await mkdir(join(root, 'skills', 'sample'), { recursive: true });
  await writeFile(join(root, 'skills', 'sample', 'SKILL.md'), '---\nname: sample\nlicense: MIT\nmetadata:\n  author: "作者团队"\n---\n');
  const timestamp = '2020-01-01T00:00:00.000Z';
  await writeFile(join(root, 'sessions', 'synthetic.jsonl'), [
    { type: 'session_meta', payload: { id: 'provenance-synthetic', cwd: 'C:/synthetic' } },
    ...['sample', 'missing'].map(skill => ({ type: 'event_msg', timestamp,
      payload: { type: 'user_message', message: `$${skill}` } })),
  ].map(JSON.stringify).join('\n'));
  return root;
}

test('opt-in current references preserve complete historical usage and default contract', async t => {
  const root = await fixture(t);
  const base = JSON.parse(run(['--codex-dir', root, '--json']).stdout);
  const result = JSON.parse(run(['--codex-dir', root, '--json', '--provenance', '--limit', '1']).stdout);
  assert.ok(!('provenance' in base));
  assert.equal(result.source, 'codex');
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.skills, base.skills);
  assert.deepEqual(result.totals, base.totals);
  assert.equal(result.provenance.temporalScope, 'current_reference_only');
  assert.equal(result.provenance.associations.length, 2);
  assert.equal(result.provenance.associations.find(item => item.skill === 'sample').status, 'candidate');
  assert.equal(result.provenance.inventory[0].originalAuthors.values[0].value[0], '作者团队');
  assert.equal(result.skills[0].lastUsedAt, '2020-01-01T00:00:00.000Z');
  assert.ok(!JSON.stringify(result.provenance).includes(root));
});

test('table limits source associations; Markdown and UTF-8 JSON exports stay complete', async t => {
  const root = await fixture(t);
  const table = run(['--codex-dir', root, '--provenance', '--limit', '1']).stdout;
  assert.match(table, /Skill 来源资料（当前参考）/);
  assert.match(table, /不证明历史作者/);
  const jsonPath = join(root, '中文输出', '来源.json');
  assert.equal(run(['--codex-dir', root, '--provenance', '--json', '--output', jsonPath]).stdout, '');
  const bytes = await readFile(jsonPath);
  assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.match(bytes.toString('utf8'), /作者团队/);
  assert.equal(JSON.parse(bytes).provenance.associations.length, 2);
  const mdPath = join(root, '中文输出', '来源.md');
  assert.equal(run(['--codex-dir', root, '--provenance', '--markdown', '--limit', '1', '--output', mdPath]).stdout, '');
  const markdown = await readFile(mdPath, 'utf8');
  assert.ok(markdown.startsWith('# Codex Skill 使用报告\n'));
  assert.match(markdown, /E3 文件声明/);
  assert.match(markdown, /作者团队/);
  assert.match(markdown, /\| missing \| unknown \|/);
  assert.match(markdown, /\| sample \| candidate \|/);
});

test('explicit root and map support U declarations and conflict without overwriting files', async t => {
  const root = await fixture(t);
  const mapPath = join(root, 'mapping.json');
  const skillPath = join(root, 'skills', 'sample', 'SKILL.md');
  const before = await readFile(skillPath);
  await writeFile(mapPath, JSON.stringify({ version: 1, entries: [{ installationId: 'standalone:sample',
    originalAuthors: ['用户声明作者'], license: 'Proprietary', acquisition: 'local_copy', localState: 'adapted' }] }));
  const result = JSON.parse(run(['--codex-dir', root, '--provenance', '--skill-root', join(root, 'skills'),
    '--provenance-map', mapPath, '--json']).stdout);
  assert.equal(result.provenance.inventory[0].originalAuthors.status, 'conflict');
  assert.equal(result.provenance.inventory[0].license.status, 'conflict');
  assert.equal(result.provenance.inventory[0].localState.values[0].evidence, 'user_declared');
  assert.deepEqual(await readFile(skillPath), before);
});

test('one plugin version root keeps namespace and publisher separate', async t => {
  const root = await fixture(t);
  const pluginRoot = join(root, 'plugin');
  await mkdir(join(pluginRoot, '.codex-plugin'), { recursive: true });
  await mkdir(join(pluginRoot, 'skills', 'sample'), { recursive: true });
  await writeFile(join(pluginRoot, '.codex-plugin', 'plugin.json'), JSON.stringify({ name: 'docs',
    version: '1.0', author: { name: 'OpenAI', email: 'secret@example.test' }, skills: './skills/' }));
  await writeFile(join(pluginRoot, 'skills', 'sample', 'SKILL.md'), '---\nname: sample\n---\n');
  const result = JSON.parse(run(['--codex-dir', root, '--provenance', '--plugin-root', pluginRoot, '--json']).stdout);
  const plugin = result.provenance.inventory.find(item => item.kind === 'plugin_package');
  assert.deepEqual(plugin.names, ['docs:sample']);
  assert.equal(plugin.originalAuthors.status, 'unknown');
  assert.equal(plugin.distribution.status, 'unknown');
  assert.doesNotMatch(JSON.stringify(result.provenance), /secret|example.test/);
});

test('invalid mapping fails before usage scan, redacts data, and never writes requested export', async t => {
  const root = await fixture(t);
  const mapPath = join(root, 'private-secret.json');
  const output = join(root, 'must-not-exist.json');
  // A log path that cannot be a rollout directory must remain untouched.
  await writeFile(mapPath, JSON.stringify({ version: 1, entries: [{ installationId: 'standalone:sample',
    publisher: 'https://user:secret@host/private' }] }));
  const result = run(['--codex-dir', root, '--provenance', '--provenance-map', mapPath, '--json', '--output', output], false);
  assert.match(result.stderr, /Invalid provenance mapping/);
  assert.doesNotMatch(result.stderr, /secret|user:|private|https/);
  await assert.rejects(readFile(output), { code: 'ENOENT' });
});

test('missing metadata is unknown while explicit registered references remain user declarations', async t => {
  const root = await fixture(t);
  const mapPath = join(root, 'map.json');
  await writeFile(mapPath, JSON.stringify({ version: 1, entries: [{ installationId: 'registered:mine',
    aliases: ['sample'], originalAuthors: ['本人'], acquisition: 'local_create', localState: 'declared_original' }] }));
  const result = JSON.parse(run(['--codex-dir', root, '--provenance', '--skill-root', join(root, 'absent'),
    '--provenance-map', mapPath, '--json']).stdout);
  assert.equal(result.provenance.inventory[0].kind, 'user_registered');
  assert.equal(result.provenance.inventory[0].originalAuthors.values[0].evidence, 'user_declared');
  assert.equal(result.provenance.associations.find(item => item.skill === 'missing').status, 'unknown');
});

for (const args of [
  ['--skill-root', 'unused'], ['--plugin-root', 'unused'], ['--provenance-map', 'unused'],
  ['--provenance', '--mcp'], ['--provenance', '--skill-root='], ['--provenance', '--plugin-root='],
  ['--provenance', '--provenance-map='],
]) test(`reject invalid provenance arguments ${args.join(' ')}`, () => run([...args, '--json'], false));
