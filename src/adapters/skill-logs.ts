import { readdir, lstat } from 'node:fs/promises';
import { join,isAbsolute,resolve,win32 } from 'node:path';
import { createHash } from 'node:crypto';
import { codexSkillReadRequests } from './codex-reads.js';
import { makeSkillPackage, pending, object, timestamp, id } from '../skill-evidence.js';
import { readSkillText, noLinks, resolveSkill } from '../skill-evidence-io.js';
import type { SkillCollectionConfig } from '../skill-evidence-io.js';
import type { SkillEvidence, SkillEvidencePackage, UnresolvedSkillEvidence } from '../skill-evidence-types.js';

const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
export function resolveLoggedSkillPath(file:string,workdir:string|null|undefined,cwd:string|null):string{
  const windows=(value:string)=>/^(?:[A-Za-z]:[\\/]|\\\\)/.test(value);
  if(windows(file)||isAbsolute(file))return file;
  if(/^[A-Za-z]:/.test(file)||workdir!==undefined&&workdir!==null&&/^[A-Za-z]:(?![\\/])/.test(workdir))return file;
  if(workdir===null)return file;
  let base=workdir??cwd;
  if(!base)return file;
  if(!windows(base)&&!isAbsolute(base)){
    if(!cwd||(!windows(cwd)&&!isAbsolute(cwd)))return file;
    base=windows(cwd)?win32.resolve(cwd,base):resolve(cwd,base);
  }
  return windows(base)?win32.resolve(base,file):resolve(base,file);
}
export function unknownLog(reason:string,sourceRecordId:string):UnresolvedSkillEvidence{
  return pending([{method:'logs',sourceRecordId,sessionId:null,turnId:null,skillKey:null,
    type:'skill_read_attempt',occurredAt:null}],reason);
}
export async function collectSkillLogEvidence(root:string,config:SkillCollectionConfig):Promise<SkillEvidencePackage>{
  const evidence:SkillEvidence[]=[],unknown:UnresolvedSkillEvidence[]=[];
  const files:string[]=[];
  for(const folder of ['sessions','archived_sessions']){
    const dir=join(root,folder);
    try{
      await lstat(dir);await noLinks(dir);
      // Explicit walking avoids following links or recursing into unrelated roots.
      const queue=[dir];
      while(queue.length){
        const next=queue.shift()!;
        const entries=await readdir(next,{withFileTypes:true});
        for(const entry of entries){
          const path=join(next,entry.name);
          if(entry.isSymbolicLink()){unknown.push(unknownLog('skipped-link',hash(path)));continue;}
          if(entry.isDirectory())queue.push(path);
          else if(entry.isFile()&&entry.name.endsWith('.jsonl'))files.push(path);
          if(files.length+queue.length>10_000)throw new Error('scan-limit');
        }
      }
    }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')unknown.push(unknownLog('directory-unreadable',hash(dir)));}
  }
  const history=join(root,'history.jsonl');
  try{await lstat(history);files.push(history);}catch(e){
    if((e as NodeJS.ErrnoException).code!=='ENOENT')unknown.push(unknownLog('history-unreadable',hash(history)));
  }
  for(const file of files.sort()){
    let text:string;try{text=await readSkillText(file);}catch{unknown.push(unknownLog('file-unreadable-or-oversize',hash(file)));continue;}
    const fileId=hash(file),lines=text.split(/\r?\n/);
    let session:string|null=null,turn:string|null=null,cwd:string|null=null;
    const sessionIds=new Set<string>(),fileEvidence:SkillEvidence[]=[];
    const emit=(row:Record<string,unknown>,payload:Record<string,unknown>,line:number,type:SkillEvidence['type'],
      value:string,by:'paths'|'names',suffix:string)=>{
      const rawTime=row.timestamp??(typeof row.ts==='number'&&Number.isFinite(row.ts)&&Math.abs(row.ts*1000)<=8.64e15?
        new Date(row.ts*1000).toISOString():null);
      const key=resolveSkill(config,value,by);
      const native=payload.call_id??payload.id??row.id;
      const sid=id(payload.session_id)?payload.session_id:id(row.session_id)?row.session_id:session;
      const tid=id(payload.turn_id)?payload.turn_id:id(row.turn_id)?row.turn_id:turn;
      const e:SkillEvidence={method:'logs',sourceRecordId:(id(native)?native:hash(JSON.stringify(row)))+':'+suffix+':'+hash(value),
        sessionId:sid,turnId:tid,skillKey:key,type,occurredAt:timestamp(rawTime),sourceRef:{fileId,line}};
      fileEvidence.push(e);
    };
    for(const [index,line]of lines.entries()){
      if(!line.trim())continue;
      let row:unknown;try{row=JSON.parse(line);}catch{unknown.push(unknownLog('malformed-log-line',fileId+':'+(index+1)));continue;}
      if(!object(row))continue;
      const p=object(row.payload)?row.payload:{};
      if(row.type==='session_meta'){
        cwd=typeof p.cwd==='string'?p.cwd:null;
        if(id(p.id)){session=p.id;sessionIds.add(session);}continue;
      }
      if(row.type==='turn_context'&&Object.hasOwn(p,'cwd'))cwd=typeof p.cwd==='string'?p.cwd:null;
      if(row.type==='turn_context'&&id(p.turn_id))turn=p.turn_id;
      if(['task_started','turn_started'].includes(p.type as string))turn=id(p.turn_id)?p.turn_id:null;
      if(['task_complete','task_completed','turn_complete','turn_completed','turn_aborted'].includes(p.type as string)){turn=null;continue;}
      const manual=(message:unknown,suffix:string)=>{
        if(typeof message!=='string')return;
        const match=/^\$([A-Za-z0-9:_./-]+)/.exec(message);
        if(match)emit(row as Record<string,unknown>,p,index+1,'skill_requested',match[1]!,'names',suffix);
      };
      if(file===history){manual(row.text,'history');continue;}
      if(p.type==='user_message')manual(p.message,'user');
      if(p.type==='message'&&p.role==='user'&&Array.isArray(p.content)){
        for(const [blockIndex,block]of p.content.entries()){
          if(!object(block)||typeof block.text!=='string')continue;
          const injection=/^<skill>\s*<name>([^<\n]+)<\/name>/.exec(block.text);
          if(injection)emit(row,p,index+1,'skill_injected',injection[1]!.trim(),'names','injected-'+blockIndex);
          else manual(block.text,'message-'+blockIndex);
        }
      }
      if(p.type==='function_call'||p.type==='custom_tool_call'){
        for(const read of codexSkillReadRequests(p))emit(row,p,index+1,'skill_read_attempt',
          resolveLoggedSkillPath(read.path,read.workdir,cwd),'paths','before');
      }
    }
    if(sessionIds.size>1)for(const e of fileEvidence){unknown.push(pending([{...e,sessionId:null}],'conflicting-session-metadata'));}
    else evidence.push(...fileEvidence);
  }
  return makeSkillPackage(config.sourceInstanceId,evidence,unknown);
}
