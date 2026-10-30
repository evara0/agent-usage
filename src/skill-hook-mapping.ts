import { createHash } from 'node:crypto';
import { pending } from './skill-evidence.js';
import { resolveSkill } from './skill-evidence-io.js';
import type { SkillCollectionConfig } from './skill-evidence-io.js';
import type { SkillEvidence, SkillEvidencePackage } from './skill-evidence-types.js';

/** Reconcile only this collector's documented exact-path digest. Never edit raw packages. */
export function resolveStoredHookSkills(packet:SkillEvidencePackage,config:SkillCollectionConfig):SkillEvidencePackage{
  if(packet.sourceInstanceId!==config.sourceInstanceId||packet.producer?.name!=='agent-usage-skill-hook'||packet.producer.version!=='1')return packet;
  const keysByDigest=new Map<string,Set<string>>();
  for(const skill of config.skills)for(const path of skill.paths){
    if(resolveSkill(config,path,'paths')!==skill.skillKey)continue;
    // Both separators are explicit representations of the same configured Windows path.
    const paths=/^[A-Za-z]:[\\/]/.test(path)?[path,path.replaceAll('\\','/'),path.replaceAll('/','\\')]:[path];
    for(const candidate of paths){
      const digest=createHash('sha256').update(candidate).digest('hex');
      const keys=keysByDigest.get(digest)??new Set<string>();keys.add(skill.skillKey);keysByDigest.set(digest,keys);
    }
  }
  const resolve=(e:SkillEvidence):SkillEvidence=>{
    if(e.skillKey!==null||e.method!=='hooks'||e.type!=='skill_read_attempt')return e;
    const digest=/:before:([0-9a-f]{64})$/.exec(e.sourceRecordId??'')?.[1];
    const keys=digest?keysByDigest.get(digest):undefined;
    return keys?.size===1?{...e,skillKey:[...keys][0]!}:e;
  };
  const evidence=packet.evidence.map(resolve);
  const unresolved=packet.deduplication.unresolvedEvidence.flatMap(u=>{
    if(u.reason!=='missing-hook-identity')return [u];
    const candidates=u.evidence.map(resolve);
    const complete=candidates.filter(e=>e.sourceRecordId&&e.sessionId&&e.turnId&&e.skillKey&&e.occurredAt);
    evidence.push(...complete);
    const remaining=candidates.filter(e=>!complete.includes(e));
    return remaining.length?[pending(remaining,u.reason)]:[];
  });
  return {...packet,evidence,skills:undefined,totals:undefined,
    deduplication:{...packet.deduplication,unresolvedEvidence:unresolved}};
}
