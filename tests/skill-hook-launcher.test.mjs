import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {existsSync} from 'node:fs';

test('diagnostic launcher distinguishes callback and collector failures without leaking native input',async t=>{
 const root=await mkdtemp(join(tmpdir(),'skill-hook-launcher-'));
 t.after(async()=>{assert.equal(dirname(root),resolve(tmpdir()));assert.match(basename(root),/^skill-hook-launcher-/);await rm(root,{recursive:true,force:true});});
 const config=join(root,'config.json'),diagnostics=join(root,'diagnostics');
 await writeFile(config,JSON.stringify({schemaVersion:1,sourceInstanceId:'test',skills:[]}));
 const args=['scripts/skill-hook-launcher.mjs','--collector','dist/skill-hook-entry.mjs','--config',config,'--home',root,'--diagnostics-dir',diagnostics];
 const input={hook_event_name:'PreToolUse',tool_name:'Bash',session_id:'SECRET_SESSION',turn_id:'SECRET_TURN',tool_use_id:'SECRET_CALL',tool_input:{command:'Write-Output SECRET_COMMAND'}};
 const r=spawnSync(process.execPath,args,{input:JSON.stringify(input),encoding:'utf8'});
 assert.equal(r.status,0);assert.equal(r.stdout,'');assert.equal(r.stderr,'');
 let text=await readFile(join(diagnostics,'latest.json'),'utf8'),receipt=JSON.parse(text);
 assert.equal(receipt.stage,'collector-completed');assert.equal(receipt.collectorExitCode,0);
 assert.equal(receipt.collectorStderrPresent,false);assert.deepEqual(receipt.knownInputFields,['command']);
 assert.deepEqual(receipt.identitiesPresent,{session_id:true,turn_id:true,tool_use_id:true});
 assert(!text.includes('SECRET_'));
 const broken=[...args];broken[broken.indexOf(config)]='missing-config';
 const failed=spawnSync(process.execPath,broken,{input:JSON.stringify(input),encoding:'utf8'});
 assert.equal(failed.status,0);assert.equal(failed.stdout,'');assert(!failed.stderr.includes('SECRET_'));
 receipt=JSON.parse(await readFile(join(diagnostics,'latest.json'),'utf8'));
 assert.equal(receipt.stage,'collector-completed');assert.equal(receipt.collectorStderrPresent,true);
 const malformed=spawnSync(process.execPath,args,{input:'SECRET_INVALID_JSON',encoding:'utf8'});
 assert.equal(malformed.status,0);assert.equal(malformed.stdout,'');assert(!malformed.stderr.includes('SECRET'));
 receipt=JSON.parse(await readFile(join(diagnostics,'latest.json'),'utf8'));
 assert.equal(receipt.stage,'launcher-failed');
});

test('Windows registration command works through configured PowerShell 7 and cmd', {skip:process.platform!=='win32'},async t=>{
 const root=await mkdtemp(join(tmpdir(),'skill-hook-launcher-'));
 t.after(async()=>{assert.equal(dirname(root),resolve(tmpdir()));assert.match(basename(root),/^skill-hook-launcher-/);await rm(root,{recursive:true,force:true});});
 const config=join(root,'config.json');
 await writeFile(config,JSON.stringify({schemaVersion:1,sourceInstanceId:'test',skills:[]}));
 // This registration strategy requires a shell-safe executable path. Arguments
 // remain quoted, including paths containing spaces.
 assert(!/[\s&|<>^()%!"'`$;]/.test(process.execPath));
 const args=[resolve('scripts/skill-hook-launcher.mjs'),'--collector',resolve('dist/skill-hook-entry.mjs'),
  '--config',config,'--home',root,'--diagnostics-dir',join(root,'diagnostic folder')];
 const command=process.execPath+' '+args.map(v=>'"'+v+'"').join(' ');
 const input=JSON.stringify({hook_event_name:'PreToolUse',tool_name:'Bash',tool_input:{command:'Write-Output smoke'}});
 const powershell=[process.env.AGENT_USAGE_PWSH,join(process.env.ProgramFiles||'C:/Program Files','PowerShell/7/pwsh.exe'),
  join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe')].find(p=>p&&existsSync(p));
 assert(powershell,'Set AGENT_USAGE_PWSH to the configured PowerShell 7 binary');
 for(const [shell,shellArgs]of [[powershell,['-NoProfile','-NonInteractive','-Command',command]],
  [process.env.ComSpec||'cmd.exe',['/d','/s','/c',command]]]){
  const r=spawnSync(shell,shellArgs,{input,encoding:'utf8',windowsHide:true,windowsVerbatimArguments:shell!==powershell});
  assert.ifError(r.error);assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');assert.equal(r.stderr,'');
  const receipt=JSON.parse(await readFile(join(root,'diagnostic folder','latest.json'),'utf8'));
  assert.equal(receipt.stage,'collector-completed');assert.equal(receipt.collectorStderrPresent,false);
 }
});
