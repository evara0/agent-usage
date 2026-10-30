import { join } from 'node:path';
import { lstat } from 'node:fs/promises';
import { readSkillConfig, readSkillPackage, readStoredSkillPackages } from './skill-evidence-io.js';
import { collectSkillLogEvidence } from './adapters/skill-logs.js';
import { createSkillReport, makeSkillPackage, mergeSkillPackages } from './skill-evidence.js';
import type { SkillMode, SkillEvidencePackage,SkillCountPolicy } from './skill-evidence-types.js';
import { resolveStoredHookSkills } from './skill-hook-mapping.js';
import {skillCodexHome} from './skill-home.js';

export async function collectSkillComparison(options:{method:SkillMode;evidencePath?:string;codexDir?:string;days?:number;countPolicy?:SkillCountPolicy}){
  let packet:SkillEvidencePackage;
  if(options.evidencePath)packet=await readSkillPackage(options.evidencePath);
  else{
    const root=skillCodexHome(options.codexDir);
    try{await lstat(join(root,'usage-skills','config.json'));}catch(e){
      if((e as NodeJS.ErrnoException).code==='ENOENT')throw new TypeError('Invalid skill evidence: config.missing; run agent-usage setup (use the same --codex-dir for setup and statistics)');throw e;
    }
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
  return createSkillReport(packet,{mode:options.method,generatedAt:now,period,countPolicy:options.countPolicy??packet.countPolicy??'resolved'});
}
