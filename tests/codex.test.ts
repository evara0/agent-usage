import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { collectCodexEvents } from '../src/adapters/codex.js';
import { aggregate } from '../src/aggregate.js';

const timestamp = '2026-10-19T08:00:00.000Z';
const posix = '/demo/skills/sample/SKILL.md';
const windows = String.raw`C:\demo\skills\sample\SKILL.md`;
const system = String.raw`C:\demo dir\skills\.system\sample\SKILL.md`;

function row(payload: object, time = timestamp) {
  return { type: 'response_item', timestamp: time, payload };
}
function call(command: unknown, name = 'exec_command', field = 'cmd') {
  return row({ type: 'function_call', name, arguments: JSON.stringify({ [field]: command }) });
}
function custom(input: string, name = 'exec') {
  return row({ type: 'custom_tool_call', name, input });
}
function injection(skill = 'sample', time = timestamp) {
  return row({ type: 'message', role: 'user', content: [
    { type: 'input_text', text: `<skill>\n<name>${skill}</name>\n<body>instructions</body></skill>` },
  ] }, time);
}

async function fixture(t: TestContext, sessions: unknown[][], history?: object[]) {
  const root = await mkdtemp(join(tmpdir(), 'skillusage-test-'));
  t.after(async () => {
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.match(basename(root), /^skillusage-test-/);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'sessions'), { recursive: true });
  await mkdir(join(root, 'archived_sessions'), { recursive: true });
  for (const [index, rows] of sessions.entries()) {
    const dir = index % 2 ? 'archived_sessions' : 'sessions';
    await writeFile(join(root, dir, `${index}.jsonl`), [
      JSON.stringify({ type: 'session_meta', payload: { id: `session-${index}`, cwd: 'C:\\demo' } }),
      ...rows.map(value => typeof value === 'string' ? value : JSON.stringify(value)),
    ].join('\n'));
  }
  if (history) {
    await writeFile(join(root, 'history.jsonl'), history.map(value => JSON.stringify(value)).join('\n'));
  }
  return { root, scan: await collectCodexEvents(root) };
}

const reads: [string, object][] = [
  ['legacy POSIX function call', call(`cat '${posix}'`)],
  ['Windows function call', call(`Get-Content -LiteralPath '${windows}'`)],
  ['Windows system path with spaces', call(`Get-Content -Path '${system}' -TotalCount 80`)],
  ['POSIX system path', call('cat /demo/skills/.system/sample/SKILL.md')],
  ['head read', call(`head -n 50 '${posix}'`)],
  ['tail read', call(`tail -n 50 '${posix}'`)],
  ['sed print read', call(`sed -n '1,200p' '${posix}'`)],
  ['PowerShell pipeline', call(`Get-Content -LiteralPath '${windows}' | Select-Object -First 80`)],
  ['PowerShell alias', call(`gc -LiteralPath '${windows}'`)],
  ['Windows type', call(`type "${windows}"`)],
  ['more read', call(`more '${posix}'`)],
  ['namespaced shell_command', call(`cat '${posix}'`, 'functions.shell_command', 'command')],
  ['multiple statements', call(`pwd; cat '${posix}'`)],
  ['shell command array', call(['bash', '-lc', `cat '${posix}'`], 'shell', 'command')],
  ['direct argv', call(['cat', posix], 'shell', 'command')],
  ['custom direct shell', custom(`Get-Content -LiteralPath '${system}'`, 'functions.exec_command')],
  ['custom nested Windows call', custom(`text(await tools.exec_command({cmd: ${JSON.stringify(`Get-Content -LiteralPath '${system}'`)}}));`)],
  ['custom single-quoted JS string', custom(`await tools.exec_command({cmd: 'cat ${posix}'});`)],
  ['custom Windows single-quoted JS string', custom(`await tools.exec_command({cmd: 'Get-Content "${windows.replaceAll('\\', '\\\\')}"'});`)],
  ['PowerShell command wrapper', call(['powershell.exe', '-NoProfile', '-Command', `Get-Content '${system}'`], 'shell', 'command')],
  ['custom static template', custom('await tools.exec_command({cmd: `cat ' + posix + '`});')],
  ['custom nested parallel calls', custom(`const results = await Promise.allSettled([tools.exec_command({cmd: ${JSON.stringify(`cat '${posix}'`)}})]); results.forEach(text);`)],
  ['function orchestration JSON code', call(`await tools.exec_command({cmd: 'cat ${posix}'});`, 'exec', 'code')],
];

for (const [name, input] of reads) {
  test(`read inference: ${name}`, async t => {
    const { scan } = await fixture(t, [[input]]);
    assert.equal(scan.events.length, 1);
    assert.deepEqual(scan.events[0], {
      skill: 'sample', fullName: 'sample', mode: 'auto', inferred: true,
      source: 'codex', timestamp, sessionId: 'session-0', cwd: 'C:\\demo', sidechain: false,
    });
  });
}

const mentions: [string, object][] = [
  ['echo mention', call(`echo '${posix}'`)],
  ['search mention', call(`rg '${posix}' README.md`)],
  ['listing', call(`ls '${posix}'`)],
  ['shell comment', call(`# cat '${posix}'`)],
  ['PowerShell block comment', call(`<#\ncat '${posix}'\n#>`)],
  ['here-doc example', call(`cat <<'EOF'\ncat '${posix}'\nEOF`)],
  ['quoted shell example', call(`echo "cat '${posix}'"`)],
  ['unrelated tool', call(`cat '${posix}'`, 'apply_patch')],
  ['unrelated metadata', row({ type: 'function_call', name: 'exec_command', arguments: JSON.stringify({cmd: 'pwd', note: posix}) })],
  ['different file', call(`cat '${posix}.bak'`)],
  ['output redirection', call(`cat > '${posix}'`)],
  ['Get-Content delimiter mention', call(`Get-Content -Delimiter '${posix}' README.md`)],
  ['head option mention', call(`head -n '${posix}' README.md`)],
  ['deeper hierarchy', call('cat /demo/skills/sample/examples/SKILL.md')],
  ['JS comment', custom(`// await tools.exec_command({cmd: 'cat ${posix}'});`)],
  ['JS block comment', custom(`/* await tools.exec_command({cmd: 'cat ${posix}'}); */`)],
  ['JS string example', custom(JSON.stringify(`await tools.exec_command({cmd: 'cat ${posix}'});`))],
  ['JS search', custom(`await tools.exec_command({cmd: "rg '${posix}' README.md"});`)],
  ['dynamic JS command', custom(`await tools.exec_command({cmd: 'cat ${posix}' + suffix});`)],
  ['spread can override command', custom(`await tools.exec_command({cmd: 'cat ${posix}', ...options});`)],
  ['dynamic template', custom('await tools.exec_command({cmd: `cat ${base}/skills/sample/SKILL.md`});')],
  ['object method example', custom(`const example = {cmd: 'cat ${posix}'}; text(example);`)],
  ['unrelated custom tool', custom(`await tools.exec_command({cmd: 'cat ${posix}'});`, 'apply_patch')],
  ['malformed arguments', row({ type: 'function_call', name: 'exec_command', arguments: `{bad ${posix}` })],
  ['malformed tool name', row({ type: 'function_call', name: 42, arguments: JSON.stringify({cmd: `cat '${posix}'`}) })],
  ['malformed JS', custom(`await tools.exec_command({cmd: 'cat ${posix}'`) ],
];

for (const [name, input] of mentions) {
  test(`non-read ignored: ${name}`, async t => {
    const { scan } = await fixture(t, [[input]]);
    assert.deepEqual(scan.events, []);
  });
}

test('one call can read multiple skills, without duplicate paths', async t => {
  const { scan } = await fixture(t, [[custom(`text(await tools.exec_command({cmd: ${JSON.stringify(
    `Get-Content '${system}'; cat /demo/skills/other/SKILL.md; cat '${posix}'`,
  )}}));`)]]);
  assert.deepEqual(scan.events.map(event => event.skill).sort(), ['other', 'sample']);
});

test('repeated reads aggregate once per session; strict excludes all inferred reads', async t => {
  const { scan } = await fixture(t, [[...reads.map(([, input]) => input)]]);
  assert.equal(aggregate(scan.events).totals.invocations, 1);
  assert.equal(aggregate(scan.events).skills[0]?.inferredAuto, 1);
  assert.equal(aggregate(scan.events, { strict: true }).totals.invocations, 0);
});

test('explicit invocation suppresses reads and manual injection echo', async t => {
  const { scan } = await fixture(t, [[
    row({ type: 'user_message', message: '$sample' }),
    injection(), ...reads.map(([, input]) => input),
  ]], [{ session_id: 'session-0', ts: Date.parse(timestamp) / 1000 + 1, text: '$sample' }]);
  const result = aggregate(scan.events);
  assert.deepEqual(result.totals, { invocations: 1, manual: 1, auto: 0, skills: 1 });
  assert.equal(result.skills[0]?.inferredAuto, 0);
  assert.deepEqual(aggregate(scan.events, {strict: true}), result);
});

test('read attempts remain inferred even when the tool reports failure', async t => {
  const { scan } = await fixture(t, [[
    call(`Get-Content '${system}'`),
    row({ type: 'function_call_output', output: 'File not found; exit code 1' }),
  ]]);
  assert.equal(scan.events[0]?.inferred, true);
  assert.equal(aggregate(scan.events, {strict: true}).totals.invocations, 0);
});

test('independent inferred sessions count separately, including archived sessions', async t => {
  const { scan } = await fixture(t, [[call(`cat '${posix}'`)], [call(`cat '${posix}'`)]]);
  assert.equal(aggregate(scan.events).totals.invocations, 2);
});

test('existing injection replay dedup and cross-session same-second limitation', async t => {
  const { scan } = await fixture(t, [[injection(), injection()], [injection()]]);
  assert.equal(aggregate(scan.events).totals.invocations, 1);
});

test('rolling days cutoff remains N times 24 hours', async t => {
  const now = Date.parse('2026-10-20T04:00:00.000Z');
  t.mock.method(Date, 'now', () => now);
  const read = call(`Get-Content '${system}'`);
  const { scan } = await fixture(t, [[
    {...read, timestamp: new Date(now - 86_400_000 - 1).toISOString()},
  ], [
    {...read, timestamp: new Date(now - 86_400_000).toISOString()},
  ]]);
  assert.equal(aggregate(scan.events, {days: 1}).totals.invocations, 1);
  assert.equal(aggregate(scan.events).totals.invocations, 2);
});

test('missing directories/history and damaged rows are harmless', async t => {
  const { root, scan } = await fixture(t, [[
    '{invalid JSON with SKILL.md', row({ type: 'function_call', arguments: null }),
    call(`cat '${posix}'`),
  ]]);
  assert.equal(scan.events.length, 1);
  const empty = await collectCodexEvents(join(root, 'missing'));
  assert.deepEqual(empty.events, []);
  // Preserve existing filesScanned bookkeeping, which includes the absent history file.
  assert.equal(empty.filesScanned, 1);
});
