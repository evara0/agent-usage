import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdtemp, mkdir, writeFile, rm, symlink, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { makeSkillPackage, createSkillReport, parseSkillPackage, mergeSkillPackages, pending } from '../src/skill-evidence.js';
import { resolveStoredHookSkills } from '../src/skill-hook-mapping.js';
import { readSkillPackage, writeSkillPackageAtomic, readStoredSkillPackages, readSkillConfig } from '../src/skill-evidence-io.js';
import { collectSkillLogEvidence } from '../src/adapters/skill-logs.js';
import { skillHookPackage } from '../src/skill-hook.js';
import { renderSkillComparison, displaySkillTime } from '../src/render/skill-comparison.js';
import type { SkillEvidence, SkillEvidencePackage } from '../src/skill-evidence-types.js';

const root='docs/examples/skill-comparison-';
const sample=async()=>JSON.parse(await readFile(root+'combined.json','utf8')) as SkillEvidencePackage;
const config={schemaVersion:1 as const,sourceInstanceId:'demo-codex-home',
  skills:[{skillKey:'standalone:handoff',names:['handoff'],paths:['C:/demo/skills/handoff/SKILL.md']}]};
async function temp(t:{after:Function}){
  const dir=await mkdtemp(join(tmpdir(),'skill-evidence-'));
  t.after(async()=>{assert.equal(dirname(dir),resolve(tmpdir()));assert.match(basename(dir),/^skill-evidence-/);await rm(dir,{recursive:true,force:true});});
  return dir;
}
test('approved three-mode fixtures independently recompute and render the same contract',async()=>{
  for(const mode of ['logs','hooks','combined']){
    const p=await readSkillPackage(root+mode+'.json');
    const r=createSkillReport(p);
    assert.deepEqual(r.totals,p.totals);
    const output=renderSkillComparison(r);
    for(const label of ['Logs Explicit','Logs Inferred','Hooks','Unique Total','Last Recorded'])assert(output.includes(label));
    assert(!output.includes('coverage'));
    const snapshot=await readFile('tests/fixtures/skill-comparison-'+mode+'.txt','utf8');
    assert.equal(output+'\n',snapshot.replaceAll('\r\n','\n'));
  }
});
test('two levels: replay is idempotent; explicit priority is only inside a turn',async()=>{
  const p=await sample();
  const r=createSkillReport(mergeSkillPackages([p,p]));
  assert.equal(r.evidence.length,9);
  assert.equal(r.totals.uniqueTotal,6);
  assert.equal(r.comparison.matched.length,3);
  assert.equal(r.comparison.logsOnly.length,2);
  assert.equal(r.comparison.hooksOnly.length,1);
  const e={...p.evidence[1]!,method:'logs' as const};
  const changed=createSkillReport({...p,evidence:[...p.evidence,e]});
  assert.equal(changed.totals.logsExplicit,2);
  assert.equal(changed.totals.logsInferred,3);
  assert.equal(changed.evidence.length,10);
});
test('same-second independent sessions and multiple turns do not collapse',()=>{
  const e:SkillEvidence={method:'logs',sourceRecordId:'r',sessionId:'s',turnId:'t',skillKey:'a',
    type:'skill_read_attempt',occurredAt:'2026-10-28T10:00:00Z'};
  const r=createSkillReport(makeSkillPackage('home',[e,{...e,sessionId:'s2'},{...e,turnId:'t2',sourceRecordId:'r2'}]));
  assert.equal(r.totals.uniqueTotal,3);
});
test('missing identity taints relevant counters but leaves other source and skill known',async()=>{
  const p=await sample();
  const e={...p.evidence[8]!,turnId:null};
  const r=createSkillReport({...p,evidence:[...p.evidence,e]});
  assert.equal(r.totals.logsExplicit,2);
  assert.equal(r.totals.hooks,null);
  assert.equal(r.totals.uniqueTotal,null);
  assert(r.deduplication.unresolvedEvidence.length>0);
  const logs=createSkillReport(r,{mode:'logs'});
  assert.equal(logs.totals.uniqueTotal,5);
  assert.equal(parseSkillPackage(r).totals!.uniqueTotal,null);
});
test('unknown skill affects every matching selected-source counter and total skill count',async()=>{
  const p=await sample();
  const r=createSkillReport({...p,evidence:[...p.evidence,{...p.evidence[0]!,sourceRecordId:'unknown',skillKey:null}]});
  assert.equal(r.totals.uniqueTotal,null);
  assert.equal(r.totals.skills,null);
  assert.equal(r.totals.hooks,4);
  const text=renderSkillComparison(r);
  assert.match(text,/Resolved evidence groups 6 · Unresolved candidates 1 \(unmapped skill 1\)/);
  assert.match(text,/Selected counts shown as — are unknown/);
  const hooks=renderSkillComparison(createSkillReport(r,{mode:'hooks'}));
  assert(!hooks.includes('Unresolved candidates'),'unselected-source pending must not trigger warnings');
});

test('stored native Hook mapping recovers only a unique explicit path digest without rewriting raw evidence',()=>{
  const input={hook_event_name:'PreToolUse',session_id:'s',turn_id:'t',tool_use_id:'c',tool_name:'Bash',
    tool_input:{command:"Get-Content 'C:/demo/skills/handoff/SKILL.md'"}};
  const raw=skillHookPackage(input,{...config,skills:[]},'2026-10-28T10:00:00Z');
  raw.deduplication.unresolvedEvidence=[pending(raw.evidence,'missing-hook-identity')];raw.evidence=[];
  const before=JSON.stringify(raw);
  const resolved=resolveStoredHookSkills(raw,config);
  assert.equal(createSkillReport(resolved).totals.hooks,1);
  assert.equal(resolved.deduplication.unresolvedEvidence.length,0);
  assert.equal(JSON.stringify(raw),before);
  assert.equal(createSkillReport(resolveStoredHookSkills(raw,{...config,skills:[]})).totals.hooks,null);
  const ambiguous={...config,skills:[...config.skills,{...config.skills[0]!,skillKey:'other',paths:['c:/DEMO/skills/handoff/SKILL.md']}]};
  assert.equal(createSkillReport(resolveStoredHookSkills(raw,ambiguous)).totals.hooks,null);
  assert.equal(resolveStoredHookSkills({...raw,producer:{name:'other',version:'1',mode:'manual'}},config).evidence.length,0);
  assert.equal(resolveStoredHookSkills({...raw,sourceInstanceId:'another-home'},config).evidence.length,0);
  const missingTurn=structuredClone(raw);missingTurn.deduplication.unresolvedEvidence[0]!.evidence[0]!.turnId=null;
  const r=createSkillReport(resolveStoredHookSkills(missingTurn,config));
  assert.equal(r.totals.hooks,null);assert.equal(r.deduplication.unresolvedEvidence[0]!.evidence[0]!.skillKey,'standalone:handoff');
  const slash=skillHookPackage({...input,tool_input:{command:'Get-Content C:\\demo\\skills\\handoff\\SKILL.md'}},{...config,skills:[]},'2026-10-28T10:00:00Z');
  slash.deduplication.unresolvedEvidence=[pending(slash.evidence,'missing-hook-identity')];slash.evidence=[];
  assert.equal(createSkillReport(resolveStoredHookSkills(slash,config)).totals.hooks,1);
});

test('unresolved diagnostics respect the selected time window',()=>{
  const old:SkillEvidence={method:'hooks',sourceRecordId:'old',sessionId:'s',turnId:'t',skillKey:null,
    type:'skill_read_attempt',occurredAt:'2026-10-01T00:00:00Z'};
  const report=createSkillReport(makeSkillPackage('home',[old]),{period:{start:'2026-10-28T00:00:00Z',end:'2026-10-29T00:00:00Z'}});
  assert(!renderSkillComparison(report).includes('Unresolved candidates'));
});
test('conflicts quarantine all candidates independent of order and remain quarantined on reimport',async()=>{
  const p=await sample();
  const conflict={...p.evidence[0]!,turnId:'other'};
  const a=createSkillReport({...p,evidence:[...p.evidence,conflict]});
  const b=createSkillReport({...p,evidence:[conflict,...p.evidence]});
  assert.deepEqual(a,b);
  assert(!a.evidence.some(e=>e.sourceRecordId===conflict.sourceRecordId&&e.method==='logs'));
  assert.equal(a.totals.logsExplicit,null);
  assert.equal(a.totals.uniqueTotal,null);
  assert.deepEqual(createSkillReport(a),a);
  assert.equal(createSkillReport(mergeSkillPackages([a,p])).totals.uniqueTotal,null);
});
test('cannot merge different instance identities; no substring-delimiter collisions',()=>{
  assert.throws(()=>mergeSkillPackages([makeSkillPackage('a'),makeSkillPackage('b')]),/sourceInstanceId/);
});
test('time window is start-inclusive/end-exclusive; latest uses evidence time; output time zone is explicit',async()=>{
  const p=await sample();
  const r=createSkillReport(p,{mode:'logs',period:{start:'2026-10-28T18:30:00+08:00',end:'2026-10-28T18:35:00+08:00'}});
  assert.equal(r.totals.uniqueTotal,1);
  assert.equal(displaySkillTime(r.skills[0]!.lastRecorded,r.timeZone),'2026-10-28 18:30');
  assert.equal(createSkillReport(p,{mode:'logs'}).skills[0]!.lastRecorded,'2026-10-28T10:30:00.000Z');
  assert.equal(createSkillReport(p).evidence.length,9,'query must not remove persisted evidence');
});
test('summary order is irrelevant; incomplete pairs and forged summaries rejected',async()=>{
  const p=await sample();
  assert.throws(()=>parseSkillPackage({...p,totals:{...p.totals,uniqueTotal:100}}),/summary/);
  assert.throws(()=>parseSkillPackage({...p,totals:undefined}),/pair/);
  const rows=p.skills!.map(r=>({lastRecorded:r.lastRecorded,hooks:r.hooks,skill:r.skill,uniqueTotal:r.uniqueTotal,
    skillKey:r.skillKey,logsInferred:r.logsInferred,logsExplicit:r.logsExplicit}));
  assert.equal(parseSkillPackage({...p,skills:rows}).skills!.length,1);
});
test('strict format: invalid timestamp, timezone, boundary, counter, enum and unknown fields rejected',async()=>{
  const p=await sample();
  for(const patch of [{schemaVersion:2},{mode:'other'},{timeZone:'bad/time'},{surprise:1},
    {period:{start:'2026-02-30T00:00:00Z',end:'2026-03-01T00:00:00Z'}},
    {period:{start:null,end:'2026-03-01T00:00:00Z'}},
    {generatedAt:'2026-10-28T10:00:00+25:00'}]){
    assert.throws(()=>parseSkillPackage({...p,...patch}));
  }
  for(const patch of [{method:'other'},{turnId:''},{occurredAt:'2026-02-30T00:00:00Z'}]){
    assert.throws(()=>parseSkillPackage({...p,skills:undefined,totals:undefined,evidence:[{...p.evidence[0],...patch}]}));
  }
  assert.throws(()=>parseSkillPackage({...p,totals:{...p.totals,hooks:-1}}));
  assert.throws(()=>parseSkillPackage({...p,totals:{...p.totals,hooks:NaN}}));
});
test('file retention: atomic writes, duplicate batches, tampered summaries, invalid UTF-8 and links',async t=>{
  const dir=await temp(t),p=await sample();
  await writeSkillPackageAtomic(dir,p);await writeSkillPackageAtomic(dir,p);
  const packets=await readStoredSkillPackages(dir);
  assert.equal(createSkillReport(mergeSkillPackages(packets)).totals.uniqueTotal,6);
  assert((await readdir(dir)).every(name=>name.endsWith('.json')));
  const invalid=join(dir,'bad.json');
  await writeFile(invalid,Buffer.from([255,254]));
  await assert.rejects(readSkillPackage(invalid));
  const link=join(dir,'linked.json');
  try{await symlink(invalid,link);}catch(e){if((e as NodeJS.ErrnoException).code==='EPERM')return;throw e;}
  await assert.rejects(readSkillPackage(link),/link/);
});
test('file limits and misleading source summaries rejected without raw content in errors',async t=>{
  const dir=await temp(t),file=join(dir,'bad.json');
  await writeFile(file,'x'.repeat(8*1024*1024+1));
  await assert.rejects(readSkillPackage(file),e=>e instanceof Error&&!e.message.includes(dir));
  await writeFile(file,'{"secret":"private-value"}');
  await assert.rejects(readSkillPackage(file),e=>e instanceof Error&&!e.message.includes('private-value'));
});
test('new logs retain call, turn, exact mapping and support unmapped/missing turns conservatively',async t=>{
  const dir=await temp(t);await mkdir(join(dir,'sessions'));
  const timestamp='2026-10-28T10:00:00Z';
  const call=(call_id:string)=>({type:'response_item',timestamp,payload:{type:'function_call',name:'exec_command',
    call_id,arguments:JSON.stringify({cmd:"Get-Content 'C:/demo/skills/handoff/SKILL.md'"})}});
  await writeFile(join(dir,'sessions','a.jsonl'),[
    {type:'session_meta',payload:{id:'s'}},
    {type:'turn_context',payload:{turn_id:'t1'}},call('c1'),call('c1'),
    {type:'turn_context',payload:{turn_id:'t2'}},call('c2'),
  ].map(value=>JSON.stringify(value)).join('\n'));
  const packet=await collectSkillLogEvidence(dir,config);
  assert.equal(createSkillReport(packet).totals.logsInferred,2);
  const unknown=await collectSkillLogEvidence(dir,{...config,skills:[]});
  assert.equal(createSkillReport(unknown).totals.uniqueTotal,null);
  await writeFile(join(dir,'history.jsonl'),JSON.stringify({session_id:'s',ts:1793181600,text:'$handoff'}));
  assert.equal(createSkillReport(await collectSkillLogEvidence(dir,config)).totals.uniqueTotal,null);
});
test('Hook input maps documented fields to read-attempt evidence; no native skill event is fabricated',()=>{
  const p=skillHookPackage({hook_event_name:'PreToolUse',session_id:'s',turn_id:'t',tool_use_id:'c',
    tool_name:'Bash',tool_input:{command:"Get-Content 'C:/demo/skills/handoff/SKILL.md'"}},config,'2026-10-28T10:00:00Z');
  assert.equal(p.evidence[0]!.type,'skill_read_attempt');
  assert.equal(p.evidence[0]!.turnId,'t');
  assert.equal(createSkillReport(p).totals.hooks,1);
  assert.throws(()=>skillHookPackage({hook_event_name:'SessionStart'},config));
});
test('config requires explicit identity mapping and handles ambiguity without guessing',async t=>{
  const dir=await temp(t),file=join(dir,'config.json');
  await writeFile(file,JSON.stringify(config));
  assert.deepEqual(await readSkillConfig(file),config);
  await writeFile(file,JSON.stringify({...config,sourceInstanceId:''}));
  await assert.rejects(readSkillConfig(file));
});

test('explicit source selection isolates logs from corrupted retained Hook files',async t=>{
  const dir=await temp(t);await mkdir(join(dir,'usage-skills'));await mkdir(join(dir,'sessions'));
  await writeFile(join(dir,'usage-skills','config.json'),JSON.stringify(config));
  await writeFile(join(dir,'usage-skills','corrupt.json'),'broken');
  const {collectSkillComparison}=await import('../src/skill-comparison-cli.js');
  const report=await collectSkillComparison({method:'logs',codexDir:dir});
  assert.equal(report.totals.uniqueTotal,0);
  await assert.rejects(collectSkillComparison({method:'hooks',codexDir:dir}));
});
test('partial identity impacts are source-scoped and window-scoped',async()=>{
  const p=await sample();
  const r=createSkillReport({...p,evidence:[...p.evidence,{...p.evidence[0]!,sourceRecordId:'no-turn',turnId:null,occurredAt:'2025-01-01T00:00:00Z'}]});
  assert.equal(r.totals.uniqueTotal,6);
  const all=createSkillReport(r,{period:{start:null,end:null}});
  assert.equal(all.totals.uniqueTotal,null);
  assert.equal(createSkillReport(all,{mode:'hooks'}).totals.uniqueTotal,4);
});
test('configuration refuses relative path identities',async t=>{
  const dir=await temp(t),file=join(dir,'config.json');
  await writeFile(file,JSON.stringify({...config,skills:[{...config.skills[0],paths:['skills/handoff/SKILL.md']}]}));
  await assert.rejects(readSkillConfig(file));
});

test('JSON object property order does not change a valid comparison report',async()=>{
  const report=createSkillReport(await sample());
  const reordered={...report,comparison:{
    hooksOnly:report.comparison.hooksOnly.map(g=>({skillKey:g.skillKey,turnId:g.turnId,sessionId:g.sessionId,sourceInstanceId:g.sourceInstanceId})),
    logsOnly:report.comparison.logsOnly,matched:report.comparison.matched}};
  assert.equal(parseSkillPackage(reordered).totals!.uniqueTotal,6);
});
