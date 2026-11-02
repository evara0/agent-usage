import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {join,dirname,basename,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const entry=resolve('dist/index.mjs');
const run=(args,options={})=>spawnSync(process.execPath,[entry,...args],{encoding:'utf8',...options});
const json=r=>{assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
async function temp(t){const dir=await mkdtemp(join(tmpdir(),'skill-onboarding-'));
 t.after(async()=>{assert.equal(dirname(dir),resolve(tmpdir()));assert.match(basename(dir),/^skill-onboarding-/);await rm(dir,{recursive:true,force:true});});return dir;}
async function skill(folder,name){await mkdir(folder,{recursive:true});await writeFile(join(folder,'SKILL.md'),'---\nname: '+name+'\n---\nExample skill.\n');}

test('fresh users independently initialize, discover roots, refresh idempotently and preserve manual/history identities',async t=>{
 const dir=await temp(t),home=join(dir,'fresh home'),other=join(dir,'other user'),project=join(dir,'project');
 await skill(join(home,'skills','demo'),'demo');await skill(join(home,'skills','.system','system-demo'),'system-demo');
 await skill(join(home,'plugins','cache','vendor','pkg','1.2.3','skills','plugin-demo'),'plugin-demo');
 await skill(join(project,'.agents','skills','local-demo'),'local-demo');
 const result=json(run(['setup','--codex-dir',home,'--project-root',project,'--json']));
 assert.equal(result.mappedSkills,4);const first=JSON.parse(await readFile(result.configPath,'utf8'));
 assert.deepEqual(Object.keys(first).sort(),['schemaVersion','skills','sourceInstanceId']);
 assert.equal(json(run(['setup','--codex-dir',home,'--json'])).changed,false);
 assert.notEqual(json(run(['setup','--codex-dir',other,'--json'])).sourceInstanceId,first.sourceInstanceId);
 const demo=first.skills.find(s=>s.names.includes('demo'));demo.skillKey='manual:stable-demo';demo.names.push('manual-alias');
 await writeFile(result.configPath,JSON.stringify(first));
 await skill(join(home,'skills','new-demo'),'new-demo');
 const refreshed=json(run(['skills','refresh','--codex-dir',home,'--json']));assert.equal(refreshed.mappedSkills,5);
 const next=JSON.parse(await readFile(result.configPath,'utf8'));
 assert.equal(next.sourceInstanceId,first.sourceInstanceId);assert(next.skills.some(s=>s.skillKey==='manual:stable-demo'&&s.names.includes('manual-alias')));
 assert(await readFile(refreshed.backup,'utf8'));
 const removed=join(home,'skills','demo');assert.equal(dirname(dirname(dirname(removed))),dir);
 await rm(removed,{recursive:true});
 assert.equal(json(run(['skills','refresh','--codex-dir',home,'--json'])).mappedSkills,5,'removed files keep historical mappings');
 const logs=json(run(['--skill-method','logs','--codex-dir',home,'--json']));
 assert.equal(logs.countPolicy,'resolved');assert.equal(logs.totals.uniqueTotal,0);
 await mkdir(join(home,'sessions'));
 const read=call_id=>({type:'response_item',timestamp:new Date().toISOString(),payload:{type:'function_call',name:'exec_command',call_id,
  arguments:JSON.stringify({cmd:'Get-Content "'+join(home,'skills',call_id==='known'?'new-demo':'not-mapped','SKILL.md').replaceAll('\\','/')+'"'})}});
 await writeFile(join(home,'sessions','fresh.jsonl'),[
  {type:'session_meta',payload:{id:'fresh-session'}},{type:'turn_context',payload:{turn_id:'fresh-turn'}},read('known'),read('unknown'),
 ].map(value=>JSON.stringify(value)).join('\n'));
 const observed=json(run(['--skill-method','logs','--codex-dir',home,'--json']));
 assert.equal(observed.totals.logsInferred,1);assert.equal(observed.deduplication.unresolvedEvidence.length,1);
 const strict=json(run(['--skill-method','logs','--skill-counts','strict','--codex-dir',home,'--json']));
 assert.equal(strict.countPolicy,'strict');assert.equal(strict.totals.uniqueTotal,null);
 const env=json(run(['--skill-method','hooks','--json'],{env:{...process.env,CODEX_HOME:home}}));assert.equal(env.sourceInstanceId,first.sourceInstanceId);
});

test('missing or invalid configuration produces guidance without mutation, discovery refuses links',async t=>{
 const dir=await temp(t),home=join(dir,'home');
 const missing=run(['--skill-method','logs','--codex-dir',home]);assert.notEqual(missing.status,0);assert.match(missing.stderr,/agent-usage setup/);
 const refresh=run(['skills','refresh','--codex-dir',home]);assert.notEqual(refresh.status,0);assert.match(refresh.stderr,/setup/);
 for(const args of [['setup','--codex-dir',''],['setup','--unknown'],['hooks','install','--project-root',dir]])assert.notEqual(run(args).status,0);
 await mkdir(join(home,'usage-skills'),{recursive:true});const config=join(home,'usage-skills','config.json');
 await writeFile(config,'{"secret":"do-not-echo"}');const invalid=run(['setup','--codex-dir',home]);
 assert.notEqual(invalid.status,0);assert(!invalid.stderr.includes('do-not-echo'));assert.equal(await readFile(config,'utf8'),'{"secret":"do-not-echo"}');
 await rm(config);await mkdir(join(home,'skills'),{recursive:true});await skill(join(dir,'target'),'linked');
 try{await symlink(join(dir,'target'),join(home,'skills','linked'),'junction');}catch(e){if(e.code==='EPERM')return;throw e;}
 const result=json(run(['setup','--codex-dir',home,'--json']));assert.equal(result.mappedSkills,0);assert(result.warnings.some(w=>w.code==='skipped-link'));
});

test('portable Hook install preserves unrelated hooks, handles Unicode/spaces and requires normal trust',async t=>{
 const dir=await temp(t),home=join(dir,"user 中文 ' space"),folder=join(home,'skills','示例');
 await skill(folder,'demo');json(run(['setup','--codex-dir',home,'--json']));
 const unrelated={hooks:{Stop:[{hooks:[{type:'command',command:'echo unrelated'}]}]}};
 await writeFile(join(home,'hooks.json'),JSON.stringify(unrelated));
 const installed=json(run(['hooks','install','--codex-dir',home,'--json']));assert.equal(installed.changed,true);assert.match(installed.next,/trust/);
 const configured=JSON.parse(await readFile(join(home,'hooks.json'),'utf8'));assert.deepEqual(configured.hooks.Stop,unrelated.hooks.Stop);
 assert.equal(json(run(['hooks','install','--codex-dir',home,'--json'])).changed,false);
 const input={hook_event_name:'PreToolUse',session_id:'s-中文',turn_id:'t',tool_use_id:'c',tool_name:'Bash',
  tool_input:{command:'Get-Content "'+join(folder,'SKILL.md').replaceAll('\\','/')+'"'}};
 const started=process.platform==='win32'?spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',installed.command],
  {input:JSON.stringify(input),encoding:'utf8',windowsVerbatimArguments:true,windowsHide:true}):spawnSync(installed.command,{shell:true,input:JSON.stringify(input),encoding:'utf8'});
 assert.ifError(started.error);assert.equal(started.status,0,started.stderr);assert.equal(started.stdout,'');assert.equal(started.stderr,'');
 const report=json(run(['--skill-method','hooks','--codex-dir',home,'--json']));assert.equal(report.totals.hooks,1);
 assert.equal(report.evidence[0].sessionId,'s-中文');
 await mkdir(join(home,'sessions'));
 await writeFile(join(home,'sessions','relative.jsonl'),[
  {type:'session_meta',payload:{id:'s-中文',cwd:home}},{type:'turn_context',payload:{turn_id:'t',cwd:home}},
  {type:'response_item',timestamp:new Date().toISOString(),payload:{type:'function_call',name:'exec_command',call_id:'outer-call',
    arguments:JSON.stringify({cmd:'Get-Content "skills/示例/SKILL.md"'})}},
 ].map(value=>JSON.stringify(value)).join('\n'));
 const combined=json(run(['--skill-method','combined','--codex-dir',home,'--json']));
 assert.equal(combined.totals.logsInferred,1);assert.equal(combined.totals.hooks,1);assert.equal(combined.totals.uniqueTotal,1);
 assert.equal(combined.comparison.matched.length,1);
 assert((await readdir(join(home,'usage-skills','backups'))).some(n=>n.startsWith('hooks-')));
});
