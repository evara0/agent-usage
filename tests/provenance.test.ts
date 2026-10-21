import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { collectSkillProvenance, loadProvenanceMapping, parseProvenanceMapping } from '../src/provenance.js';
import { renderProvenanceMarkdown, renderProvenanceTable } from '../src/render/provenance.js';
import type { ProvenanceMapping } from '../src/provenance-types.js';

const observedAt = '2026-10-21T10:00:00.000Z';
async function fixture(t: { after: (callback: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'agent-usage-provenance-'));
  t.after(async () => {
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.match(basename(root), /^agent-usage-provenance-/);
    await rm(root, { recursive: true, force: true });
  });
  const skillRoot = join(root, 'skills');
  await mkdir(skillRoot);
  return { root, skillRoot };
}
async function addSkill(root: string, folder: string, front = 'name: sample') {
  await mkdir(join(root, folder), { recursive: true });
  await writeFile(join(root, folder, 'SKILL.md'), `---\n${front}\n---\nInstructions ignored.\n`, 'utf8');
}
const stats = (...aliases: string[]) => ({ skill: aliases[0]!, aliases });
const get = (report: Awaited<ReturnType<typeof collectSkillProvenance>>, id = 'standalone:sample') => {
  const item = report.inventory.find(item => item.id === id);
  assert.ok(item); return item;
};

test('file declarations separate authors, license and unknown distribution/acquisition/local state', async t => {
  const { skillRoot } = await fixture(t);
  await addSkill(skillRoot, 'sample', 'name: sample\nlicense: MIT\nmetadata:\n  author: "原作者团队"');
  const result = await collectSkillProvenance([stats('sample')], { skillRoot, observedAt });
  const item = get(result);
  assert.deepEqual(item.originalAuthors, { status: 'declared', values: [{ value: ['原作者团队'], evidence: 'file_declared', scope: 'skill' }] });
  for (const field of ['publisher', 'distribution', 'acquisition', 'localState'] as const) assert.equal(item[field].status, 'unknown');
  assert.equal(item.license.values[0]?.value, 'MIT');
  assert.equal(result.temporalScope, 'current_reference_only');
  assert.equal(result.associations[0]?.status, 'candidate');
  assert.equal(result.observedAt, observedAt);
});

test('.system and official-looking names never certify official publisher or local creation', async t => {
  const { skillRoot } = await fixture(t);
  await addSkill(skillRoot, '.system/openai-helper', 'name: openai-helper');
  const result = await collectSkillProvenance([stats('openai-helper')], { skillRoot, observedAt });
  const item = get(result, 'standalone:.system/openai-helper');
  assert.equal(item.distribution.status, 'unknown');
  assert.equal(item.originalAuthors.status, 'unknown');
  assert.equal(item.localState.status, 'unknown');
});

async function addPlugin(root: string, manifest: unknown, portable = false) {
  const pluginRoot = join(root, 'plugin');
  await mkdir(join(pluginRoot, '.codex-plugin'), { recursive: true });
  await writeFile(join(pluginRoot, portable ? 'plugin.json' : '.codex-plugin/plugin.json'), JSON.stringify(manifest));
  await addSkill(join(pluginRoot, 'skills'), 'sample', 'name: sample');
  return pluginRoot;
}

test('plugin package author is publisher, namespace required, repository and credentials never exported', async t => {
  const { root, skillRoot } = await fixture(t);
  const pluginRoot = await addPlugin(root, { name: 'docs', version: '1.0.0', skills: './skills/',
    author: { name: 'OpenAI', email: 'private@example.test' }, license: 'Proprietary',
    repository: 'https://user:secret@github.com/private/project?token=secret' });
  const result = await collectSkillProvenance([stats('docs:sample'), stats('sample')], { skillRoot, pluginRoot, observedAt });
  const item = get(result, 'plugin:docs@1.0.0:skills/sample');
  assert.equal(item.publisher.values[0]?.value, 'OpenAI');
  assert.equal(item.publisher.values[0]?.scope, 'package');
  assert.equal(item.originalAuthors.status, 'unknown');
  assert.equal(item.distribution.status, 'unknown');
  assert.equal(item.acquisition.status, 'unknown');
  assert.equal(result.associations[0]?.status, 'candidate');
  assert.equal(result.associations[1]?.status, 'unknown');
  assert.doesNotMatch(JSON.stringify(result), /secret|private|https|example.test/);
  assert.ok(!JSON.stringify(result).includes(root));
});

test('portable identity takes priority; compatibility overlay is not merged', async t => {
  const { root, skillRoot } = await fixture(t);
  const pluginRoot = await addPlugin(root, { $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name: 'portable', version: '2.0', author: { name: 'Portable Team' } }, true);
  await writeFile(join(pluginRoot, '.codex-plugin/plugin.json'), JSON.stringify({ name: 'wrong', version: '1',
    author: { name: 'Wrong Team' }, skills: './skills/' }));
  const result = await collectSkillProvenance([stats('portable:sample')], { skillRoot, pluginRoot, observedAt });
  assert.equal(get(result, 'plugin:portable@2.0:skills/sample').publisher.values[0]?.value, 'Portable Team');
  assert.doesNotMatch(JSON.stringify(result), /Wrong Team|plugin:wrong/);
});

test('plugin custom paths and unrecognized portable formats are refused, not traversed', async t => {
  const { root, skillRoot } = await fixture(t);
  const pluginRoot = await addPlugin(root, { name: 'docs', version: '1', skills: '../../private' });
  const result = await collectSkillProvenance([], { skillRoot, pluginRoot, observedAt });
  assert.equal(result.inventory.length, 0);
  assert.equal(result.diagnostics.unsupportedMetadata, 1);
  await writeFile(join(pluginRoot, 'plugin.json'), JSON.stringify({ name: 'unknown', skills: './skills/' }));
  assert.equal((await collectSkillProvenance([], { skillRoot, pluginRoot, observedAt })).inventory.length, 0);
});

test('user claims stay U, preserve file conflicts, list collaborators, and mark registered-only references', async t => {
  const { skillRoot } = await fixture(t);
  await addSkill(skillRoot, 'sample', 'name: sample\nlicense: MIT');
  const mapping = parseProvenanceMapping({ version: 1, entries: [
    { installationId: 'standalone:sample', aliases: ['old-name'], publisher: '维护团队', originalAuthors: ['乙', '甲'],
      license: 'Proprietary', distribution: 'openai_official', acquisition: 'local_copy', localState: 'adapted' },
    { installationId: 'registered:missing', aliases: ['uninstalled'], originalAuthors: ['本人'], acquisition: 'local_create' },
    { installationId: 'standalone:absent', publisher: 'Unused' },
  ] });
  const result = await collectSkillProvenance([stats('old-name'), stats('uninstalled')], { skillRoot, observedAt, mapping });
  const item = get(result);
  assert.equal(item.license.status, 'conflict');
  assert.equal(item.license.values.length, 2);
  assert.deepEqual(item.originalAuthors.values[0]?.value, ['乙', '甲'].sort());
  assert.equal(item.distribution.values[0]?.evidence, 'user_declared');
  assert.equal(result.associations[0]?.status, 'candidate');
  assert.equal(get(result, 'registered:missing').kind, 'user_registered');
  assert.equal(result.diagnostics.unmatchedMappings, 1);
});

test('same name, aggregated aliases and version changes are not silently assigned', async t => {
  const { skillRoot } = await fixture(t);
  await addSkill(skillRoot, 'first');
  await addSkill(skillRoot, 'second');
  const result = await collectSkillProvenance([stats('sample'), stats('first', 'second'), stats('first', 'old'),
    stats('first-1.0.0')], { skillRoot, observedAt });
  assert.deepEqual(result.associations.map(item => item.status), ['ambiguous', 'ambiguous', 'ambiguous', 'unknown']);
  assert.equal(result.associations[0]?.candidateIds.length, 2);
  assert.deepEqual(result.associations[2]?.unresolvedAliases, ['old']);
});

test('multiple explicitly registered versions sharing a namespaced alias are ambiguous', async t => {
  const { skillRoot } = await fixture(t);
  const mapping = parseProvenanceMapping({ version: 1, entries: [
    { installationId: 'registered:version1', aliases: ['pkg:sample'] },
    { installationId: 'registered:version2', aliases: ['pkg:sample'] },
  ] });
  const result = await collectSkillProvenance([stats('pkg:sample')], { skillRoot, observedAt, mapping });
  assert.equal(result.associations[0]?.status, 'ambiguous');
});

test('missing, malformed, oversized, complex and sensitive metadata degrade safely', async t => {
  const { root, skillRoot } = await fixture(t);
  await mkdir(join(skillRoot, 'missing'));
  await addSkill(skillRoot, 'complex', 'name: complex\nlicense: [MIT]\nmetadata:\n  author: user@example.test');
  await addSkill(skillRoot, 'duplicate', 'name: duplicate\nmetadata:\n  author: First\nmetadata:\n  author: Second');
  await addSkill(skillRoot, 'bad');
  await writeFile(join(skillRoot, 'bad', 'SKILL.md'), Buffer.from([0xff]));
  await addSkill(skillRoot, 'huge');
  await writeFile(join(skillRoot, 'huge', 'SKILL.md'), 'x'.repeat(65_537));
  const result = await collectSkillProvenance([stats('complex')], { skillRoot, observedAt });
  assert.equal(result.inventory.length, 2);
  assert.equal(get(result, 'standalone:complex').originalAuthors.status, 'unknown');
  assert.equal(get(result, 'standalone:duplicate').originalAuthors.status, 'unknown');
  assert.ok(result.diagnostics.missingFiles >= 1);
  assert.ok(result.diagnostics.unsupportedMetadata >= 3);
  assert.equal(result.diagnostics.invalidMetadata, 1);
  const missing = await collectSkillProvenance([stats('never')], { skillRoot: join(root, 'absent'), observedAt });
  assert.equal(missing.associations[0]?.status, 'unknown');
  assert.equal(missing.diagnostics.missingFiles, 1);
});

test('directories and explicit roots using junctions/symlinks are not followed', async t => {
  const { root, skillRoot } = await fixture(t);
  const outside = join(root, 'outside');
  await mkdir(outside);
  await addSkill(outside, 'secret');
  await symlink(outside, join(skillRoot, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = await collectSkillProvenance([], { skillRoot, observedAt });
  assert.equal(result.inventory.length, 0);
  assert.equal(result.diagnostics.skippedLinks, 1);
  const linkedRoot = await collectSkillProvenance([], { skillRoot: join(skillRoot, 'linked'), observedAt });
  assert.equal(linkedRoot.inventory.length, 0);
  assert.equal(linkedRoot.diagnostics.skippedLinks, 1);
});

test('ambiguous YAML keys, duplicate metadata forms and non-string scalars never assert authorship', async t => {
  const { skillRoot } = await fixture(t);
  const fronts = [
    'name: sample\nmetadata:\n  author: Alice\nmetadata: {author: Eve}',
    'name: sample\nmetadata:\n  author: Alice\n  "author": Eve',
    'name: sample\nmetadata:\n  author: Alice\n   author: Eve',
    'name: sample\nmetadata:\n  author: true',
    'name: sample\nmetadata:\n  author: 123',
    'name: sample\nmetadata:\n  author: Alice\n"metadata": {author: Eve}',
  ];
  for (const [index, front] of fronts.entries()) await addSkill(skillRoot, `case${index}`, front);
  const result = await collectSkillProvenance([], { skillRoot, observedAt });
  assert.equal(result.inventory.length, fronts.length);
  for (const item of result.inventory) assert.equal(item.originalAuthors.status, 'unknown');
  assert.ok(result.diagnostics.unsupportedMetadata >= fronts.length);
});

test('directory limits surface incomplete inventory without scanning extra files', async t => {
  const { skillRoot } = await fixture(t);
  for (let i = 0; i < 257; i++) await mkdir(join(skillRoot, `item${i}`));
  const result = await collectSkillProvenance([], { skillRoot, observedAt });
  assert.equal(result.diagnostics.truncatedDirectories, 1);
  assert.equal(result.diagnostics.missingFiles, 256);
});

for (const entries of [
  [{ installationId: 'registered:a' }], [{ installationId: '../private', aliases: ['foo'] }],
  [{ installationId: 'standalone:foo', author: 'wrong-key' }],
  [{ installationId: 'standalone:foo', publisher: 'user@example.test' }],
  [{ installationId: 'standalone:foo', publisher: 'https://user:secret@host' }],
  [{ installationId: 'standalone:foo', originalAuthors: 'Person' }],
  [{ installationId: 'standalone:foo', originalAuthors: [] }],
  [{ installationId: 'standalone:foo', originalAuthors: ['Person', 'Person'] }],
  [{ installationId: 'standalone:foo', distribution: 'official' }],
  [{ installationId: 'standalone:foo', acquisition: 'github' }],
  [{ installationId: 'standalone:foo', localState: true }],
  [{ installationId: 'standalone:foo', aliases: ['a', 'a'] }],
  [{ installationId: 'standalone:foo' }, { installationId: 'standalone:foo' }],
]) {
  test(`invalid mapping rejected: ${JSON.stringify(entries)}`, () => {
    assert.throws(() => parseProvenanceMapping({ version: 1, entries }), /Invalid provenance mapping/);
  });
}

test('mapping root shape, size, files and text encoding are validated with redacted errors', async t => {
  const { root } = await fixture(t);
  assert.throws(() => parseProvenanceMapping({ version: 2, entries: [] }));
  assert.throws(() => parseProvenanceMapping({ version: 1, entries: [], unexpected: 'secret' }));
  assert.throws(() => parseProvenanceMapping({ version: 1, entries: Array(257).fill({}) }));
  const path = join(root, 'private-secret-map.json');
  await writeFile(path, '{"secret":');
  await assert.rejects(loadProvenanceMapping(path), error => error instanceof Error &&
    /Invalid provenance mapping/.test(error.message) && !error.message.includes('secret'));
  await writeFile(path, 'x'.repeat(65_537));
  await assert.rejects(loadProvenanceMapping(path), /Unable to read provenance mapping/);
  await assert.rejects(loadProvenanceMapping(root), /Unable to read provenance mapping/);
  await writeFile(path, JSON.stringify({ version: 1, entries: [] }));
  assert.deepEqual(await loadProvenanceMapping(path), { version: 1, entries: [] });
});

test('collection is read-only; raw paths and unsafe aliases not in provenance; mapping is copied', async t => {
  const { root, skillRoot } = await fixture(t);
  await addSkill(skillRoot, 'sample');
  const before = await readFile(join(skillRoot, 'sample', 'SKILL.md'));
  const beforeNames = await readdir(root, { recursive: true });
  const input = { version: 1 as const, entries: [{ installationId: 'standalone:sample', publisher: 'Team' }] };
  const mapping = parseProvenanceMapping(input);
  input.entries[0]!.publisher = 'Changed';
  const result = await collectSkillProvenance([stats('C:/private/secret')], { skillRoot, observedAt, mapping });
  assert.equal(get(result).publisher.values[0]?.value, 'Team');
  assert.ok(!JSON.stringify(result).includes(root));
  assert.doesNotMatch(JSON.stringify(result), /secret|Changed/);
  assert.deepEqual(await readFile(join(skillRoot, 'sample', 'SKILL.md')), before);
  assert.deepEqual(await readdir(root, { recursive: true }), beforeNames);
  await assert.rejects(collectSkillProvenance([], { skillRoot, observedAt,
    mapping: { version: 2, entries: [] } as unknown as ProvenanceMapping }), /Invalid provenance mapping/);
});

test('Markdown renders full inventory and associations while table respects skill row limit', async t => {
  const { skillRoot } = await fixture(t);
  await addSkill(skillRoot, 'sample', 'name: sample\nmetadata:\n  author: "团队 | <甲>"');
  await addSkill(skillRoot, 'unused', 'name: unused');
  const result = await collectSkillProvenance([stats('sample'), stats('missing')], { skillRoot, observedAt });
  const markdown = renderProvenanceMarkdown(result);
  assert.match(markdown, /仅当前来源候选/);
  assert.match(markdown, /E3 文件声明/);
  assert.match(markdown, /&#124;/);
  assert.match(markdown, /&#60;甲&#62;/);
  assert.match(markdown, /standalone&#58;unused/);
  assert.match(markdown, /missing/);
  const table = renderProvenanceTable(result, 1);
  assert.match(table, /sample/);
  assert.doesNotMatch(table, /missing\s*│/);
});
