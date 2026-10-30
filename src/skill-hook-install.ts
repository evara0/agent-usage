import {readdir,readFile,lstat,realpath} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readSkillConfig,readSkillText,noLinks} from './skill-evidence-io.js';
import {object} from './skill-evidence.js';
import {atomicSkillText,backupSkillFile} from './skill-setup.js';
import {skillCodexHome} from './skill-home.js';

const signature='Record Skill usage (agent-usage)';
const psLiteral=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const shLiteral=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
const winArgument=(value:string)=>'"'+value.replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/,'$1$1')+'"';

export function windowsSkillLauncher(node:string,collector:string,config:string,home:string):string{
  const args=[collector,'--config',config,'--home',home].map(winArgument).join(' ');
  // Use raw streams rather than a PowerShell pipeline, which can change stdin encoding.
  return '\uFEFF'+`$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = ${psLiteral(node)}
  $start.Arguments = ${psLiteral(args)}
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $child = New-Object System.Diagnostics.Process
  $child.StartInfo = $start
  [void]$child.Start()
  $stdout = $child.StandardOutput.ReadToEndAsync()
  $stderr = $child.StandardError.ReadToEndAsync()
  [Console]::OpenStandardInput().CopyTo($child.StandardInput.BaseStream)
  $child.StandardInput.Close()
  $child.WaitForExit()
  [Console]::Out.Write($stdout.GetAwaiter().GetResult())
  [Console]::Error.Write($stderr.GetAwaiter().GetResult())
  $child.Dispose()
} catch {
  [Console]::Error.WriteLine('agent-usage Skill Hook: launcher failed')
}
exit 0
`;
}

export async function installSkillHook(options:{codexDir?:string;bundleDir?:string}={}){
  const home=skillCodexHome(options.codexDir),configPath=join(home,'usage-skills','config.json');
  try{await lstat(configPath);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')throw new Error('Skill configuration is missing; run agent-usage setup first.');throw e;}
  await readSkillConfig(configPath);
  const bundle=options.bundleDir??dirname(fileURLToPath(import.meta.url));
  const names=(await readdir(bundle)).filter(n=>n.endsWith('.mjs')).sort();
  if(!names.includes('skill-hook-entry.mjs')||names.length>32)throw new Error('Build the package before installing the Skill Hook.');
  const files=[];let bytes=0;
  for(const name of names){const file=join(bundle,name);const stat=await lstat(file);
    if(!stat.isFile()||stat.isSymbolicLink()||(bytes+=stat.size)>16*1024*1024)throw new Error('Invalid Hook bundle.');
    files.push({name,text:await readFile(file,'utf8')});}
  const node=await realpath(process.execPath);
  const digest=createHash('sha256').update(JSON.stringify(files)).update(node).update(home).digest('hex').slice(0,16);
  const installation=join(home,'tools','agent-usage','hooks',digest),collector=join(installation,'skill-hook-entry.mjs');
  for(const file of files){
    const target=join(installation,file.name);let existing:string|undefined;
    try{existing=await readSkillText(target,16*1024*1024);}catch(e){try{await lstat(target);}catch(missing){if((missing as NodeJS.ErrnoException).code==='ENOENT'){await atomicSkillText(target,file.text);continue;}throw missing;}throw e;}
    if(existing!==file.text)throw new Error('Pinned Hook installation differs; retain it for inspection.');
  }
  const launcher=process.platform==='win32'?join(installation,'launch.ps1'):undefined;
  let command:string;
  if(launcher){
    const text=windowsSkillLauncher(node,collector,configPath,home);
    await atomicSkillText(launcher,text);
    command='powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(text.slice(1),'utf16le').toString('base64');
    if(command.length>8000)throw new Error('Windows Hook command exceeds its shell limit; use shorter Node/Codex paths.');
  }else command=[node,collector,'--config',configPath,'--home',home].map(shLiteral).join(' ');
  const hookPath=join(home,'hooks.json');let hooks:Record<string,unknown>={},exists=false;
  try{await lstat(hookPath);exists=true;hooks=JSON.parse(await readSkillText(hookPath,1024*1024)) as Record<string,unknown>;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Unable to read existing hooks.json; it was not replaced.');}
  if(!object(hooks)||hooks.hooks!==undefined&&!object(hooks.hooks))throw new Error('Invalid hooks.json; it was not replaced.');
  const map=object(hooks.hooks)?hooks.hooks:{};hooks.hooks=map;
  if(map.PreToolUse!==undefined&&!Array.isArray(map.PreToolUse))throw new Error('Invalid PreToolUse configuration.');
  const groups=(map.PreToolUse??[]) as unknown[];map.PreToolUse=groups;
  const matches:{group:Record<string,unknown>;handlers:unknown[];index:number}[]=[];
  for(const g of groups){if(!object(g)||!Array.isArray(g.hooks))throw new Error('Invalid PreToolUse group.');
    g.hooks.forEach((h,index)=>{if(object(h)&&h.statusMessage===signature)matches.push({group:g,handlers:g.hooks as unknown[],index});});}
  if(matches.length>1)throw new Error('Multiple agent-usage Hook registrations require manual reconciliation.');
  const previous=matches[0];
  if(previous&&previous.group.matcher!=='Bash')throw new Error('Existing agent-usage matcher requires manual reconciliation.');
  const existingHandler=previous?.handlers[previous.index];
  const handler={...(object(existingHandler)?existingHandler:{}),
    type:'command',command,timeout:5,statusMessage:signature} as Record<string,unknown>;
  delete handler.commandWindows;delete handler.command_windows;
  const changed=!previous||JSON.stringify(previous.handlers[previous.index])!==JSON.stringify(handler);
  let backup:string|undefined;
  if(changed){
    if(previous)previous.handlers[previous.index]=handler;else groups.push({matcher:'Bash',hooks:[handler]});
    if(exists)backup=await backupSkillFile(home,hookPath,'hooks');
    await atomicSkillText(hookPath,JSON.stringify(hooks,null,2)+'\n');
  }
  return {hookPath,configPath,collector,...(launcher?{launcher}:{}),command,changed,...(backup?{backup}:{}),
    next:'Review the installed collector/launcher, then use Codex /hooks to trust PreToolUse / Bash. Hooks must be enabled in Codex.'};
}
