import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createSkillReport,makeSkillPackage} from '../src/skill-evidence.js';
import {renderMarkdown} from '../src/render/markdown.js';
import type {SkillEvidence,SkillEvidencePackage} from '../src/skill-evidence-types.js';
const fixture=async()=>JSON.parse(await readFile('docs/examples/skill-comparison-combined.json','utf8')) as SkillEvidencePackage;

test('three modes render the same new report counts and explicit timezone with six columns',async()=>{
 for(const [mode,total]of [['logs',5],['hooks',4],['combined',6]] as const){
  const report=createSkillReport(await fixture(),{mode});const before=structuredClone(report);
  const text=renderMarkdown(report);
  assert(text.startsWith('# Codex Skill 使用报告\n'));
  assert(text.includes('| Skill | Logs Explicit | Logs Inferred | Hooks | Unique Total | Last Recorded |'));
  assert(text.includes(total+' skill-turns'));assert.match(text,/2026-10-28 18:\d\d/);
  assert.equal(renderMarkdown(report),text);assert.deepEqual(report,before);
  if(mode==='hooks')assert.match(text,/\| handoff \| — \| — \| 4 \| 4 \|/);
  if(mode==='logs')assert.match(text,/\| handoff \| 2 \| 3 \| — \| 5 \|/);
 }
});
test('resolved and strict counts retain pending view diagnostics without reclassifying evidence',()=>{
 const e:SkillEvidence={method:'logs',sourceRecordId:'one',sessionId:'s',turnId:'t',skillKey:'demo',type:'skill_read_attempt',occurredAt:'2026-10-28T10:00:00Z'};
 const p=makeSkillPackage('local',[e,{...e,sourceRecordId:'unknown',skillKey:null}]);
 const resolved=createSkillReport(p,{countPolicy:'resolved'}),strict=createSkillReport(p,{countPolicy:'strict'});
 assert.match(renderMarkdown(resolved),/Counts Resolved evidence/);assert.match(renderMarkdown(resolved),/1 skill-turns/);
 assert.match(renderMarkdown(strict),/Counts Strict/);assert.match(renderMarkdown(strict),/— skill-turns/);
 assert.match(renderMarkdown(resolved),/Unresolved candidates 1/);
 assert(!renderMarkdown(createSkillReport(p,{mode:'hooks'})).includes('Unresolved candidates'));
 const outside=createSkillReport(p,{period:{start:'2026-10-29T00:00:00Z',end:'2026-10-30T00:00:00Z'}});
 assert(!renderMarkdown(outside).includes('Unresolved candidates'));
});
test('Markdown escapes labels, remains pure with frozen input, and never truncates rows',()=>{
 const evidence:SkillEvidence[]=Array.from({length:30},(_,i)=>({method:'logs',sourceRecordId:String(i),sessionId:'s',turnId:String(i),
  skillKey:'demo:'+i,type:'skill_read_attempt',occurredAt:'2026-10-28T10:00:00Z'}));
 const report=createSkillReport(makeSkillPackage('local',evidence),{timeZone:'UTC'});
 report.skills[0]!.skill='x|`*_[]<img src="x">\r\n伪造\u0000';
 report.generatedAt='<script>test</script>\n| injected |';
 const freeze=(value:object)=>{for(const item of Object.values(value))if(item&&typeof item==='object')freeze(item);Object.freeze(value);};
 const before=structuredClone(report);freeze(report);const text=renderMarkdown(report);
 assert.equal(renderMarkdown(report),text);assert.deepEqual(report,before);
 assert(!/<img|<script|\r|\u0000/.test(text));assert(text.includes('&#124;'));assert(text.includes('&#60;script&#62;'));
 assert.equal(text.split('\n').filter(line=>line.startsWith('| ')).length,32);
 assert(text.includes('2026-10-28 10:00'));assert(text.endsWith('\n'));
 const empty=renderMarkdown(createSkillReport(makeSkillPackage('local')));
 assert(empty.includes('All time'));assert(empty.includes('没有身份完整'));assert(empty.includes('0 skill-turns'));
});
