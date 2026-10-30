#!/usr/bin/env node
// Optional native-callback diagnosis. Never persist command text or native IDs.
import {parseArgs} from 'node:util';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,rename,lstat} from 'node:fs/promises';
import {resolve,dirname,parse,join} from 'node:path';
import {randomUUID} from 'node:crypto';

let receiptPath;
const receipt={schemaVersion:1,startedAt:new Date().toISOString(),stage:'started'};
async function save(){
 if(!receiptPath)return;
 const temporary=receiptPath+'.'+randomUUID()+'.tmp';
 await writeFile(temporary,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 await rename(temporary,receiptPath);
}
async function noLinks(file){
 const absolute=resolve(file);let current=parse(absolute).root;
 for(const part of absolute.slice(current.length).split(/[\\/]/).filter(Boolean)){
  current=join(current,part);
  try{if((await lstat(current)).isSymbolicLink())throw Error('link');}
  catch(error){if(error.code==='ENOENT')break;throw error;}
 }
}
try{
 const {values}=parseArgs({options:{collector:{type:'string'},config:{type:'string'},home:{type:'string'},'diagnostics-dir':{type:'string'}},strict:true});
 if(!values.collector||!values.config||!values.home||!values['diagnostics-dir'])throw Error('arguments');
 const target=join(resolve(values['diagnostics-dir']),'latest.json');
 await noLinks(target);await mkdir(dirname(target),{recursive:true});await noLinks(target);
 receiptPath=target;
 await save();
 const chunks=[];let size=0;
 for await(const chunk of process.stdin){size+=chunk.length;if(size>1024*1024)throw Error('input-size');chunks.push(chunk);}
 const raw=Buffer.concat(chunks),input=JSON.parse(raw.toString('utf8'));
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const fields=['session_id','turn_id','tool_use_id'];
 receipt.stage='input-parsed';
 receipt.eventSupported=input?.hook_event_name==='PreToolUse';
 receipt.toolName=['Bash','exec_command','exec','functions.exec'].includes(input?.tool_name)?input.tool_name:'other';
 receipt.identitiesPresent=Object.fromEntries(fields.map(key=>[key,typeof input?.[key]==='string'&&input[key].length>0]));
 receipt.toolInputType=Array.isArray(input?.tool_input)?'array':typeof input?.tool_input;
 receipt.knownInputFields=object(input?.tool_input)?['command','cmd','code','input'].filter(k=>Object.hasOwn(input.tool_input,k)):[];
 await save();
 const child=spawnSync(process.execPath,[resolve(values.collector),'--config',resolve(values.config),'--home',resolve(values.home)],
  {input:raw,encoding:'utf8',timeout:3500,maxBuffer:64*1024,windowsHide:true});
 receipt.stage='collector-completed';
 receipt.collectorExitCode=child.status;
 receipt.collectorLaunchFailed=Boolean(child.error);
 receipt.collectorStderrPresent=Boolean(child.stderr);
 receipt.collectorStdoutPresent=Boolean(child.stdout);
 await save();
 if(child.error||child.status!==0||child.stderr)console.error('agent-usage Skill Hook: collector diagnostic reported a failure');
}catch{
 receipt.stage='launcher-failed';await save().catch(()=>{});
 console.error('agent-usage Skill Hook: launcher diagnostic failed');
}
