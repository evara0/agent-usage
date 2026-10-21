import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

test('Hooks rejects Skill provenance options before reading a missing mapping or writing output', async t => {
  const root = await mkdtemp(join(tmpdir(), 'agent-usage-integration-'));
  t.after(async () => {
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.match(basename(root), /^agent-usage-integration-/);
    await rm(root, { recursive: true, force: true });
  });
  const missing = join(root, 'missing-private-input');
  const output = join(root, 'must-not-exist.json');
  const cases = [
    ['--provenance'],
    ['--provenance', '--provenance-map', missing],
    ['--provenance', '--skill-root', missing],
    ['--provenance', '--plugin-root', missing],
    ['--skill-root', missing],
    ['--plugin-root', missing],
    ['--provenance-map', missing],
  ];
  for (const args of cases) {
    const result = spawnSync(process.execPath, ['dist/index.mjs', '--hooks', '--json',
      '--codex-dir', missing, '--output', output, ...args], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 1, args.join(' '));
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /--provenance/);
    assert.doesNotMatch(result.stderr, /Unable to read|Invalid provenance mapping|missing-private-input/);
    await assert.rejects(access(output));
  }
});

test('Unified help exposes all independent modes and provenance input options', () => {
  const result = spawnSync(process.execPath, ['dist/index.mjs', '--help'], { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  for (const option of ['--mcp', '--hooks', '--provenance', '--skill-root', '--plugin-root', '--provenance-map']) {
    assert.ok(result.stdout.includes(option), option);
  }
});
