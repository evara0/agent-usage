import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { readSkillConfig, readSkillPackage, readStoredSkillPackages } from './skill-evidence-io.js';
import { collectSkillLogEvidence } from './adapters/skill-logs.js';
import { createSkillReport, makeSkillPackage, mergeSkillPackages } from './skill-evidence.js';
import type { SkillMode, SkillEvidencePackage } from './skill-evidence-types.js';
import { resolveStoredHookSkills } from './skill-hook-mapping.js';

export async function collectSkillComparison(options:{method:SkillMode;evidencePath?:string;codexDir?:string;days?:number}){
  let packet:SkillEvidencePackage;
  if(options.evidencePath)packet=await readSkillPackage(options.evidencePath);
  else{
    const root=resolve(options.codexDir??join(homedir(),'.codex'));
    const config=await readSkillConfig(join(root,'usage-skills','config.json'));
    const packets:SkillEvidencePackage[]=[];
    if(options.method!=='hooks')packets.push(await collectSkillLogEvidence(root,config));
    if(options.method!=='logs')packets.push(...(await readStoredSkillPackages(join(root,'usage-skills'))).map(p=>resolveStoredHookSkills(p,config)));
    packets.unshift(makeSkillPackage(config.sourceInstanceId));
    packet=mergeSkillPackages(packets);
  }
  const now=new Date().toISOString();
  const period=options.days===undefined?packet.period:{
    start:new Date(Date.parse(now)-options.days*86_400_000).toISOString(),end:now};
  return createSkillReport(packet,{mode:options.method,generatedAt:now,period});
}
