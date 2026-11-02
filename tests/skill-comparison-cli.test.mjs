import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
const sample='docs/examples/skill-comparison-combined.json';
function run(args){
 const r=spawnSync(process.execPath,['dist/index.mjs',...args],{encoding:'utf8'});
 assert.ifError(r.error);return r;
}
async function temp(t){
 const dir=await mkdtemp(join(tmpdir(),'skill-comparison-cli-'));
 t.after(async()=>{assert.equal(dirname(dir),resolve(tmpdir()));assert.match(basename(dir),/^skill-comparison-cli-/);await rm(dir,{recursive:true,force:true});});
 return dir;
}
for(const [mode,expected]of [['logs',5],['hooks',4],['combined',6]]){
 test('CLI '+mode+' exports and round trips full evidence with table limit',async t=>{
  const dir=await temp(t),out=join(dir,'roundtrip.json');
  const r=run(['--skill-method',mode,'--skill-evidence',sample,'--json','--limit','1','--output',out]);
  assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');
  const report=JSON.parse(await readFile(out,'utf8'));
  assert.equal(report.totals.uniqueTotal,expected);assert.equal(report.evidence.length,9);
  const replay=run(['--skill-method',mode,'--skill-evidence',out,'--json']);
  assert.equal(replay.status,0,replay.stderr);
  assert.deepEqual(JSON.parse(replay.stdout).skills,report.skills);
  const table=run(['--skill-method',mode,'--skill-evidence',sample]);
  assert.equal(table.status,0,table.stderr);assert.match(table.stdout,/2026-10-28 18:/);
 });
}
test('incompatible flags fail before evidence is read or output written',async t=>{
 const dir=await temp(t),out=join(dir,'must-not-exist.json');
 for(const flag of ['--hooks','--mcp','--strict','--provenance']){
  const r=run(['--skill-method','logs',flag,'--skill-evidence',join(dir,'missing'),'--json','--output',out]);
  assert.notEqual(r.status,0);assert.equal(r.stdout,'');assert.match(r.stderr,/cannot combine/);
 }
 for(const args of [['--skill-method','bad'],['--skill-method','logs','--skill-counts','bad']]){
  const r=run(args);assert.notEqual(r.status,0);assert.equal(r.stdout,'');
 }
});
test('explicit config joins retained Hook packages with native log rows',async t=>{
 const dir=await temp(t);await mkdir(join(dir,'usage-skills'));await mkdir(join(dir,'sessions'));
 await writeFile(join(dir,'usage-skills','config.json'),JSON.stringify({schemaVersion:1,sourceInstanceId:'demo-codex-home',
  skills:[{skillKey:'standalone:handoff',names:['handoff'],paths:['C:/demo/skills/handoff/SKILL.md']}]}));
 await writeFile(join(dir,'usage-skills','hook.json'),await readFile(sample));
 const time='2026-10-28T11:00:00+08:00';
 await writeFile(join(dir,'sessions','log.jsonl'),[
  {type:'session_meta',payload:{id:'session-a'}},{type:'turn_context',payload:{turn_id:'turn-03'}},
  {type:'response_item',timestamp:time,payload:{type:'function_call',name:'exec_command',call_id:'native-call',
   arguments:JSON.stringify({cmd:"Get-Content 'C:/demo/skills/handoff/SKILL.md'"})}},
 ].map(JSON.stringify).join('\n'));
 const r=run(['--skill-method','combined','--codex-dir',dir,'--json']);
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).totals.uniqueTotal,6);
});
test('Hook command writes portable evidence atomically and fails open without raw input',async t=>{
 const dir=await temp(t),config=join(dir,'config.json');
 await writeFile(config,JSON.stringify({schemaVersion:1,sourceInstanceId:'test-instance',
  skills:[{skillKey:'standalone:handoff',names:[],paths:['C:/demo/skills/handoff/SKILL.md']}]}));
 const input={hook_event_name:'PreToolUse',session_id:'s',turn_id:'t',tool_use_id:'c',tool_name:'Bash',
  tool_input:{command:"Get-Content 'C:/demo/skills/handoff/SKILL.md'"}};
 const r=spawnSync(process.execPath,['dist/skill-hook-entry.mjs','--config',config,'--home',dir],
  {input:JSON.stringify(input),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');assert.equal(r.stderr,'');
 const read=run(['--skill-method','hooks','--codex-dir',dir,'--json']);
 // Config for the reader is deliberately explicit in usage-skills.
 await writeFile(join(dir,'usage-skills','config.json'),await readFile(config));
 const ready=run(['--skill-method','hooks','--codex-dir',dir,'--json']);
 assert.notEqual(read.status,0);assert.equal(ready.status,0,ready.stderr);
 assert.equal(JSON.parse(ready.stdout).totals.hooks,1);
 await mkdir(join(dir,'sessions'));
 await writeFile(join(dir,'sessions','matching.jsonl'),[
  {type:'session_meta',payload:{id:'s'}},{type:'turn_context',payload:{turn_id:'t'}},
  {type:'response_item',timestamp:new Date().toISOString(),payload:{type:'function_call',name:'exec_command',call_id:'c',
    arguments:JSON.stringify({cmd:input.tool_input.command})}}
 ].map(JSON.stringify).join('\n'));
 const combined=run(['--codex-dir',dir,'--json']);
 assert.equal(combined.status,0,combined.stderr);
 const result=JSON.parse(combined.stdout);
 assert.equal(result.totals.logsInferred,1);assert.equal(result.totals.hooks,1);assert.equal(result.totals.uniqueTotal,1);
 assert.equal(result.comparison.matched.length,1);
 const failed=spawnSync(process.execPath,['dist/skill-hook-entry.mjs','--config','nonexistent','--home',dir],
  {input:'{"secret":"never-print-this"}',encoding:'utf8'});
 assert.equal(failed.status,0);assert.equal(failed.stdout,'');assert(!failed.stderr.includes('never-print-this'));
});

test('updated explicit mapping reconciles retained native Hook evidence read-only and explains remaining unknowns',async t=>{
 const dir=await temp(t),store=join(dir,'usage-skills');await mkdir(store);
 const config=join(store,'config.json');
 await writeFile(config,JSON.stringify({schemaVersion:1,sourceInstanceId:'mapping-test',skills:[]}));
 const input={hook_event_name:'PreToolUse',session_id:'s',turn_id:'t',tool_use_id:'c',tool_name:'Bash',
  tool_input:{command:'Get-Content C:/demo/skills/new-skill/SKILL.md'}};
 const collected=spawnSync(process.execPath,['dist/skill-hook-entry.mjs','--config',config,'--home',dir],
  {input:JSON.stringify(input),encoding:'utf8'});
 assert.equal(collected.status,0,collected.stderr);
 const packet=join(store,(await readdir(store)).find(f=>f.startsWith('evidence-')));
 const original=await readFile(packet,'utf8');
 const unknown=run(['--skill-method','hooks','--codex-dir',dir]);
 assert.equal(unknown.status,0,unknown.stderr);assert.match(unknown.stdout,/Unresolved candidates 1 \(unmapped skill 1\)/);
 await writeFile(config,JSON.stringify({schemaVersion:1,sourceInstanceId:'mapping-test',
  skills:[{skillKey:'standalone:new-skill',names:['new-skill'],paths:['C:/demo/skills/new-skill/SKILL.md']}]}));
 const ready=run(['--skill-method','hooks','--codex-dir',dir,'--json']);
 assert.equal(ready.status,0,ready.stderr);assert.equal(JSON.parse(ready.stdout).totals.hooks,1);
 assert.equal(JSON.parse(ready.stdout).deduplication.unresolvedEvidence.length,0);
 assert.equal(await readFile(packet,'utf8'),original,'query must not rewrite retained packages');
});
