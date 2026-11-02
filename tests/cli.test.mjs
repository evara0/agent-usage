import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
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

const sample='docs/examples/skill-comparison-combined.json';
for (const format of ['--json', '--markdown', 'table']) {
  test(`default combined matches explicit combined: ${format}`, () => {
    const base=['--skill-evidence',sample,...(format==='table'?[]:[format])];
    const implicit=run(base), explicit=run(['--skill-method','combined',...base]);
    if(format==='--json') {
      const a=JSON.parse(implicit), b=JSON.parse(explicit);
      delete a.generatedAt; delete b.generatedAt;
      assert.deepEqual(a,b);
      assert.equal(a.kind,'skill-usage-comparison');
      assert.equal(a.schemaVersion,1);
      assert.equal(a.totals.uniqueTotal,6);
      for(const key of ['strict','windowDays','filesScanned','elapsedMs','source']) assert(!(key in a));
    } else assert.equal(implicit.replace(/^- Generated At .*$/m,''),explicit.replace(/^- Generated At .*$/m,''));
  });
}
test('default strict counts and row limit use new report',()=>{
 const r=JSON.parse(run(['--skill-evidence',sample,'--skill-counts','strict','--json','--limit','1']));
 assert.equal(r.countPolicy,'strict'); assert.equal(r.totals.uniqueTotal,6);assert.equal(r.skills.length,1);
 assert.match(run(['--skill-evidence',sample]),/Logs Explicit/);
});
test('missing setup fails with actionable diagnostic',()=>{
 const r=spawnSync(process.execPath,['dist/index.mjs','--codex-dir',join(tmpdir(),'agent-usage-no-such-home'),'--json'],{encoding:'utf8'});
 assert.notEqual(r.status,0);assert.equal(r.stdout,'');assert.match(r.stderr,/config.missing.*setup/);
});
test('conflicting output modes are rejected before scanning', () => {
  run(['--markdown', '--json'], false);
});

test('default JSON export is complete and BOM-free',async t=>{
 const root=await mkdtemp(join(tmpdir(),'agent-usage-default-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const out=join(root,'report.json');
 assert.equal(run(['--skill-evidence',sample,'--json','--output',out]),'');
 const bytes=await readFile(out);assert.notDeepEqual([...bytes.subarray(0,3)],[239,187,191]);
 assert.equal(JSON.parse(bytes.toString('utf8')).totals.uniqueTotal,6);
 run(['--skill-evidence',sample,'--json','--output',root],false);
});
test('removed strict explains migration before reading input',()=>{
 const r=spawnSync(process.execPath,['dist/index.mjs','--strict','--codex-dir','missing'],{encoding:'utf8'});
 assert.notEqual(r.status,0);assert.equal(r.stdout,'');assert.match(r.stderr,/removed.*--skill-counts strict/);
});

for (const args of [['--output', 'unused.md'], ['--output'], ['--json', '--output=']]) {
  test(`invalid file export rejected: ${args.join(' ')}`, () => run(args, false));
}

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

for(const independent of ['--mcp','--hooks','--provenance']) {
 for(const option of [['--skill-evidence',sample],['--skill-counts','resolved']]) {
  test(`independent ${independent} rejects ${option[0]} before reads`,()=>run([independent,...option,'--codex-dir','missing','--json'],false));
 }
}
