import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
const sample='docs/examples/skill-comparison-combined.json';
const run=args=>spawnSync(process.execPath,['dist/index.mjs',...args],{encoding:'utf8'});
async function temp(t){const dir=await mkdtemp(join(tmpdir(),'skill-markdown-'));t.after(async()=>{
 assert.equal(dirname(dir),resolve(tmpdir()));assert.match(basename(dir),/^skill-markdown-/);await rm(dir,{recursive:true,force:true});});return dir;}
for(const [mode,total]of [['logs',5],['hooks',4],['combined',6]])test('Markdown '+mode+' uses the same replayed counts as JSON',()=>{
 const args=['--skill-method',mode,'--skill-evidence',sample];
 const md=run([...args,'--markdown','--limit','1']);assert.equal(md.status,0,md.stderr);assert(md.stdout.startsWith('# Codex Skill 使用报告\n'));
 const json=run([...args,'--json']);assert.equal(json.status,0,json.stderr);const report=JSON.parse(json.stdout);
 assert.equal(report.totals.uniqueTotal,total);assert(md.stdout.includes(total+' skill-turns'));
 assert(md.stdout.includes('| Skill | Logs Explicit | Logs Inferred | Hooks | Unique Total | Last Recorded |'));
 assert.match(md.stdout,/2026-10-28 18:\d\d/);assert(!md.stdout.includes('filesScanned'));
});
test('full Markdown ignores row limit, escapes names and exports BOM-free UTF-8 with overwrite',async t=>{
 const dir=await temp(t),input=join(dir,'report.json'),output=join(dir,'中文目录','报告.md');
 const p=JSON.parse(await readFile(sample,'utf8'));delete p.skills;delete p.totals;delete p.comparison;
 for(let i=0;i<30;i++)p.evidence.push({...p.evidence[0],sourceRecordId:'extra-'+i,turnId:'turn-'+i,skillKey:'extra:'+i});
 await writeFile(input,JSON.stringify(p));
 const r=run(['--skill-method','combined','--skill-evidence',input,'--markdown','--limit','1','--output',output]);
 assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');let bytes=await readFile(output);assert.notDeepEqual([...bytes.subarray(0,3)],[239,187,191]);
 let text=bytes.toString('utf8');assert.equal(text.split('\n').filter(line=>line.startsWith('| ')).length,33);assert(text.endsWith('\n'));
 await writeFile(output,'obsolete');
 const again=run(['--skill-method','combined','--skill-evidence',input,'--markdown','--output',output]);assert.equal(again.status,0,again.stderr);
 assert(!(await readFile(output,'utf8')).includes('obsolete'));
 const failed=run(['--skill-method','combined','--skill-evidence',input,'--markdown','--output',dir]);assert.notEqual(failed.status,0);assert.equal(failed.stdout,'');
});
test('strict/resolved pending reports and window/mode selection match upstream evidence',async t=>{
 const dir=await temp(t),input=join(dir,'pending.json');const p=JSON.parse(await readFile(sample,'utf8'));
 delete p.skills;delete p.totals;delete p.comparison;p.evidence.push({...p.evidence[0],sourceRecordId:'unmapped',skillKey:null});
 await writeFile(input,JSON.stringify(p));
 const base=['--skill-method','combined','--skill-evidence',input,'--markdown'];
 const resolved=run([...base,'--skill-counts','resolved']);assert.equal(resolved.status,0,resolved.stderr);assert.match(resolved.stdout,/6 skill-turns/);assert.match(resolved.stdout,/Unresolved candidates 1/);
 const strict=run([...base,'--skill-counts','strict']);assert.equal(strict.status,0,strict.stderr);assert.match(strict.stdout,/— skill-turns/);
 const outside=run([...base,'--days','0.00000001']);assert.equal(outside.status,0,outside.stderr);assert.match(outside.stdout,/0 skill-turns/);
});
test('legacy and conflicting Markdown commands fail before input reads or output writes',async t=>{
 const dir=await temp(t),out=join(dir,'never-created.md');
 for(const args of [['--markdown','--strict'],['--provenance','--markdown'],
  ['--skill-method','logs','--markdown','--json'],['--skill-method','logs','--markdown','--strict']]){
  const r=run([...args,'--codex-dir',join(dir,'missing'),'--output',out]);assert.notEqual(r.status,0);assert.equal(r.stdout,'');assert(r.stderr.trim());
 }

 await assert.rejects(access(out));
});
