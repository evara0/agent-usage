import { lstat, open, readdir, mkdir, rename, unlink } from 'node:fs/promises';
import { resolve, dirname, parse, join, isAbsolute, win32 } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseSkillPackage, fail, id, object } from './skill-evidence.js';
import type { SkillEvidencePackage } from './skill-evidence-types.js';

export const MAX_SKILL_BYTES = 8 * 1024 * 1024;
export async function noLinks(path: string): Promise<void> {
  const abs=resolve(path), root=parse(abs).root;
  let current=root;
  for(const part of abs.slice(root.length).split(/[\\/]/).filter(Boolean)) {
    current=join(current,part);
    const stat=await lstat(current);
    if(stat.isSymbolicLink()) fail('file.link');
  }
}
export async function readSkillText(path: string, max=MAX_SKILL_BYTES): Promise<string> {
  try {
    await noLinks(path);
    const fh=await open(path,'r');
    try {
      const st=await fh.stat();
      if(!st.isFile()||st.size>max) fail('file.size/type');
      const buffer=Buffer.alloc(max+1);
      let bytes=0;
      while(bytes<buffer.length) {
        const r=await fh.read(buffer,bytes,buffer.length-bytes,null);
        if(!r.bytesRead)break;bytes+=r.bytesRead;
      }
      if(bytes>max)fail('file.size');
      return new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,bytes));
    } finally { await fh.close(); }
  } catch(error) {
    if(error instanceof TypeError && error.message.startsWith('Invalid skill evidence:'))throw error;
    fail('file.read');
  }
}
export async function readSkillPackage(path:string):Promise<SkillEvidencePackage> {
  const text=await readSkillText(path);
  let data:unknown;try{data=JSON.parse(text);}catch{fail('file.json');}
  return parseSkillPackage(data);
}
export interface SkillCollectionConfig {
  schemaVersion:1; sourceInstanceId:string;
  skills:{skillKey:string;names:string[];paths:string[]}[];
}
export async function readSkillConfig(path:string):Promise<SkillCollectionConfig>{
  let data:unknown;try{data=JSON.parse(await readSkillText(path,64*1024));}catch{fail('config.read');}
  return parseSkillConfig(data);
}
export function parseSkillConfig(data:unknown):SkillCollectionConfig{
  if(!object(data)||data.schemaVersion!==1||!id(data.sourceInstanceId)||!Array.isArray(data.skills)||data.skills.length>256||
    Object.keys(data).some(k=>!['schemaVersion','sourceInstanceId','skills'].includes(k)))fail('config');
  const keys=new Set<string>();
  for(const item of data.skills){
    if(!object(item)||!id(item.skillKey)||keys.has(item.skillKey)||
      Object.keys(item).some(k=>!['skillKey','names','paths'].includes(k))||
      !Array.isArray(item.names)||!Array.isArray(item.paths)||item.names.length+item.paths.length===0||
      item.names.length>32||item.paths.length>32||![...item.names,...item.paths].every(id)||
      item.paths.some(p=>typeof p!=='string'||(!isAbsolute(p)&&!win32.isAbsolute(p))))fail('config.skills');
    keys.add(item.skillKey);
  }
  return data as unknown as SkillCollectionConfig;
}
export function resolveSkill(config:SkillCollectionConfig, value:string, by:'names'|'paths'):string|null{
  const normal=(s:string)=>by==='paths' && /^[A-Za-z]:[\\/]/.test(s)?s.replaceAll('\\','/').toLowerCase():s;
  const matches=config.skills.filter(s=>s[by].some(v=>normal(v)===normal(value)));
  return matches.length===1?matches[0]!.skillKey:null;
}
export async function readStoredSkillPackages(root:string):Promise<SkillEvidencePackage[]>{
  try{await lstat(root);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
  await noLinks(root);
  const entries=await readdir(root,{withFileTypes:true});
  if(entries.length>10_000)fail('store.limit');
  const output:SkillEvidencePackage[]=[];
  for(const e of entries.sort((a,b)=>a.name.localeCompare(b.name))){
    if(e.name==='config.json'||!e.name.endsWith('.json'))continue;
    output.push(await readSkillPackage(join(root,e.name)));
  }
  return output;
}
export async function writeSkillPackageAtomic(root:string, packet:SkillEvidencePackage):Promise<string>{
  const accepted=parseSkillPackage(packet);
  const data=JSON.stringify(accepted,null,2)+'\n';
  if(Buffer.byteLength(data)>MAX_SKILL_BYTES)fail('file.size');
  let existing=resolve(root);
  for(;;){try{await lstat(existing);break;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const parent=dirname(existing);if(parent===existing)throw e;existing=parent;}}
  await noLinks(existing);
  await mkdir(root,{recursive:true});await noLinks(root);
  const name='evidence-'+randomUUID()+'.json';
  const target=join(root,name),temporary=join(root,'.'+name+'.tmp');
  const fh=await open(temporary,'wx');
  try{await fh.writeFile(data,'utf8');await fh.sync();}finally{await fh.close();}
  try{await rename(temporary,target);}catch(e){await unlink(temporary).catch(()=>{});throw e;}
  return target;
}
