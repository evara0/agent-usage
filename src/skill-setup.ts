import {readdir,lstat,mkdir,open,rename,unlink,copyFile} from 'node:fs/promises';
import {join,resolve,dirname,basename,isAbsolute} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {noLinks,readSkillConfig,readSkillText,resolveSkill,parseSkillConfig,type SkillCollectionConfig} from './skill-evidence-io.js';
import {fail,id,object} from './skill-evidence.js';
import {skillCodexHome} from './skill-home.js';

export async function atomicSkillText(file:string,text:string):Promise<void>{
  let existing=resolve(file);
  for(;;){try{await lstat(existing);break;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;
    const parent=dirname(existing);if(parent===existing)throw e;existing=parent;}}
  await noLinks(existing);await mkdir(dirname(file),{recursive:true});await noLinks(dirname(file));
  try{await noLinks(file);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const temporary=file+'.'+randomUUID()+'.tmp';
  const handle=await open(temporary,'wx');try{await handle.writeFile(text,'utf8');await handle.sync();}finally{await handle.close();}
  try{await rename(temporary,file);}catch(e){await unlink(temporary).catch(()=>{});throw e;}
}
export async function backupSkillFile(home:string,file:string,label:string):Promise<string>{
  await noLinks(file);
  const backup=join(home,'usage-skills','backups',label+'-'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID()+'.json');
  const folder=dirname(backup);let existing=folder;
  for(;;){try{await lstat(existing);break;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;existing=dirname(existing);}}
  await noLinks(existing);await mkdir(folder,{recursive:true});await noLinks(folder);await copyFile(file,backup);
  return backup;
}
export interface SkillSetupOptions {codexDir?:string;skillRoots?:string[];pluginRoots?:string[];projectRoots?:string[];refresh?:boolean}
export async function setupSkillCollection(options:SkillSetupOptions={}){
  const home=skillCodexHome(options.codexDir),configPath=join(home,'usage-skills','config.json');
  const settingsPath=join(home,'usage-skills','settings','discovery.json');
  let previous:SkillCollectionConfig|undefined;
  try{await lstat(configPath);previous=await readSkillConfig(configPath);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(options.refresh&&!previous)throw new Error('Skill configuration is missing; run agent-usage setup first.');
  type Discovery={schemaVersion:1;skillRoots:string[];pluginRoots:string[];projectRoots:string[]};
  let previousDiscovery:Discovery|undefined;
  try{
    await lstat(settingsPath);const data:unknown=JSON.parse(await readSkillText(settingsPath,64*1024));
    if(!object(data)||data.schemaVersion!==1||Object.keys(data).some(k=>!['schemaVersion','skillRoots','pluginRoots','projectRoots'].includes(k)))fail('discovery.settings');
    for(const key of ['skillRoots','pluginRoots','projectRoots'])if(!Array.isArray(data[key])||data[key].length>32||data[key].some(v=>!id(v)||!isAbsolute(v)))fail('discovery.settings');
    previousDiscovery=data as unknown as Discovery;
  }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const roots=(old:string[]|undefined,added:string[]|undefined)=>[...new Set([...(old??[]),...(added??[]).map(r=>resolve(r))])].sort();
  const discovery={skillRoots:roots(previousDiscovery?.skillRoots,options.skillRoots),
    pluginRoots:roots(previousDiscovery?.pluginRoots,options.pluginRoots),projectRoots:roots(previousDiscovery?.projectRoots,options.projectRoots)};
  if(Object.values(discovery).some(r=>r.length>32))throw new Error('Too many discovery roots (maximum 32 of each kind).');
  const config:SkillCollectionConfig={schemaVersion:1,sourceInstanceId:previous?.sourceInstanceId??randomUUID(),
    skills:structuredClone(previous?.skills??[])};
  const warnings:{code:string;count:number}[]=[];const warn=(code:string)=>{const found=warnings.find(w=>w.code===code);if(found)found.count++;else warnings.push({code,count:1});};
  for(const root of Object.values(discovery).flat()){
    try{await noLinks(root);if(!(await lstat(root)).isDirectory())warn('invalid-configured-root');}
    catch(e){warn((e as NodeJS.ErrnoException).code==='ENOENT'?'missing-configured-root':'unreadable-configured-root');}
  }
  let directoryCount=0,discovered=0,added=0;
  async function directories(root:string){
    if(++directoryCount>10_000)throw new Error('Skill discovery directory limit exceeded.');
    try{await noLinks(root);const entries=await readdir(root,{withFileTypes:true});
      if(entries.length>10_000)throw new Error('Skill discovery directory limit exceeded.');
      for(const entry of entries)if(entry.isSymbolicLink())warn('skipped-link');
      return entries.filter(e=>e.isDirectory()&&!e.isSymbolicLink()).map(e=>e.name).sort();
    }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];if(e instanceof Error&&e.message.includes('limit exceeded'))throw e;warn('unreadable-root');return [];}
  }
  const digest=(s:string)=>createHash('sha256').update(process.platform==='win32'?s.toLowerCase():s).digest('hex').slice(0,16);
  async function addSkill(folder:string,key:string,aliases:(name:string|undefined)=>string[]){
    const file=join(folder,'SKILL.md');let text:string;
    try{await lstat(file);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;warn('unreadable-skill');return;}
    try{text=await readSkillText(file,64*1024);}catch{warn('unreadable-skill');return;}
    const matches=[...(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1]??'').matchAll(/^name:\s*["']?([^"'\r\n]+?)["']?\s*$/gm)];
    const name=matches.length===1&&id(matches[0]![1])?matches[0]![1]:undefined;
    const names=aliases(name).filter(id);
    const normal=(s:string)=>process.platform==='win32'?s.replaceAll('\\','/').toLowerCase():s;
    const existing=config.skills.filter(s=>s.paths.some(p=>normal(p)===normal(file)));
    if(existing.length>1){warn('ambiguous-configured-path');return;}
    const exact=resolveSkill(config,file,'paths');
    let entry=exact?config.skills.find(s=>s.skillKey===exact):config.skills.find(s=>s.skillKey===key);
    if(!entry){entry={skillKey:key,names:[],paths:[]};config.skills.push(entry);added++;}
    entry.names=[...new Set([...entry.names,...names])].sort();
    entry.paths=[...new Set([...entry.paths,file.replaceAll('\\','/')])].sort();discovered++;
  }
  async function skillRoot(root:string,prefix:string,namespaced?:string){
    for(const leaf of await directories(root)){
      if(leaf.startsWith('.'))continue;
      await addSkill(join(root,leaf),prefix+leaf,name=>namespaced?[namespaced+':'+leaf,...(name?[namespaced+':'+name]:[])]:[leaf,...(name?[name]:[])]);
    }
  }
  await skillRoot(join(home,'skills'),'standalone:');
  await skillRoot(join(home,'skills','.system'),'standalone:.system/');
  for(const root of discovery.skillRoots)await skillRoot(root,'custom:'+digest(root)+':');
  for(const project of discovery.projectRoots)for(const sub of ['.agents','.codex']){
    const root=join(project,sub,'skills');await skillRoot(root,'project:'+digest(root)+':');
  }
  async function plugin(root:string,pkg:string,version:string){
    await skillRoot(join(root,'skills'),'plugin:'+pkg+'@'+version+':'+digest(root)+':',pkg);
  }
  const cache=join(home,'plugins','cache');
  for(const vendor of await directories(cache))for(const pkg of await directories(join(cache,vendor)))
    for(const version of await directories(join(cache,vendor,pkg)))await plugin(join(cache,vendor,pkg,version),pkg,version);
  for(const root of discovery.pluginRoots)await plugin(root,basename(dirname(root)),basename(root));
  config.skills.sort((a,b)=>a.skillKey.localeCompare(b.skillKey));
  const text=JSON.stringify(config,null,2)+'\n';
  if(config.skills.length>256||Buffer.byteLength(text)>64*1024||config.skills.some(s=>s.names.length>32||s.paths.length>32))fail('config.discovery-limit');
  parseSkillConfig(config);
  const configChanged=!previous||JSON.stringify(previous)!==JSON.stringify(config);
  const settings:Discovery={schemaVersion:1,...discovery};
  const discoveryChanged=JSON.stringify(previousDiscovery)!==JSON.stringify(settings);
  const changed=configChanged||discoveryChanged;
  let backup:string|undefined;
  if(configChanged){
    if(previous)backup=await backupSkillFile(home,configPath,'config');
    await atomicSkillText(configPath,text);
    await readSkillConfig(configPath);
  }
  if(discoveryChanged)await atomicSkillText(settingsPath,JSON.stringify(settings,null,2)+'\n');
  return {home,configPath,settingsPath,sourceInstanceId:config.sourceInstanceId,changed,mappedSkills:config.skills.length,discovered,added,warnings,...(backup?{backup}:{}),
    next:'agent-usage --skill-method logs --days 1'};
}
