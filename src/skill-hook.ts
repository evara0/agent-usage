import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { codexSkillReadPaths } from './adapters/codex-reads.js';
import { object, id, makeSkillPackage, pending } from './skill-evidence.js';
import { readSkillConfig, resolveSkill, writeSkillPackageAtomic } from './skill-evidence-io.js';
import type { SkillCollectionConfig } from './skill-evidence-io.js';
import type { SkillEvidence, SkillEvidencePackage } from './skill-evidence-types.js';

export function skillHookPackage(input:unknown,config:SkillCollectionConfig,now=new Date().toISOString()):SkillEvidencePackage{
  if(!object(input)||input.hook_event_name!=='PreToolUse')throw new TypeError('Unsupported Skill Hook event');
  const args=object(input.tool_input)?input.tool_input:{};
  const name=input.tool_name==='Bash'?'exec_command':input.tool_name;
  const call={type:'function_call',name:typeof name==='string'?name:'',arguments:JSON.stringify(
    input.tool_name==='Bash'?{cmd:args.command??args.cmd}:args)};
  const evidence:SkillEvidence[]=codexSkillReadPaths(call).map(path=>({
    method:'hooks',sourceRecordId:id(input.tool_use_id)?input.tool_use_id+':before:'+
      createHash('sha256').update(path).digest('hex'):null,
    sessionId:id(input.session_id)?input.session_id:null,turnId:id(input.turn_id)?input.turn_id:null,
    skillKey:resolveSkill(config,path,'paths'),type:'skill_read_attempt',occurredAt:now,
  }));
  const packet=makeSkillPackage(config.sourceInstanceId,evidence);
  packet.producer={name:'agent-usage-skill-hook',version:'1',mode:'automated'};
  return packet;
}
export async function runSkillHook(configPath:string,home:string,input:unknown):Promise<void>{
  const config=await readSkillConfig(configPath);
  const packet=skillHookPackage(input,config);
  if(!packet.evidence.length)return;
  const complete=packet.evidence.filter(e=>e.sourceRecordId&&e.sessionId&&e.turnId&&e.skillKey);
  packet.deduplication.unresolvedEvidence=packet.evidence.filter(e=>!complete.includes(e)).map(e=>pending([e],'missing-hook-identity'));
  packet.evidence=complete;
  await writeSkillPackageAtomic(join(home,'usage-skills'),packet);
}
