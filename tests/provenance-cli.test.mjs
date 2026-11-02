import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {test} from 'node:test';

function run(args,success=true,options={}){
 const result=spawnSync(process.execPath,['dist/index.mjs',...args],{encoding:'utf8',...options});
 assert.ifError(result.error);assert.equal(result.status===0,success,result.stderr);
 if(!success)assert.equal(result.stdout,'');return result;
}
async function skill(root,name,author='作者团队'){
 const file=join(root,name,'SKILL.md');await mkdir(dirname(file),{recursive:true});
 await writeFile(file,'---\nname: '+name+'\nlicense: MIT\nmetadata:\n  author: "'+author+'"\n---\n');return file;
}
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'agent-usage-provenance-cli-'));
 t.after(async()=>{assert.equal(dirname(root),resolve(tmpdir()));assert.match(basename(root),/^agent-usage-provenance-cli-/);await rm(root,{recursive:true,force:true});});
 const first=await skill(join(root,'skills'),'sample'),unused=await skill(join(root,'skills'),'unused');
 await mkdir(join(root,'usage-skills'));
 const config={schemaVersion:1,sourceInstanceId:'inventory-instance',skills:[
  {skillKey:'standalone:sample',names:['sample'],paths:[first]},
  {skillKey:'standalone:unused',names:['unused'],paths:[unused]},
  {skillKey:'standalone:missing',names:['missing'],paths:[join(root,'skills','missing','SKILL.md')]},
 ]};
 await writeFile(join(root,'usage-skills','config.json'),JSON.stringify(config));
 // These are not log directories/documents. Inventory must never inspect them.
 await writeFile(join(root,'sessions'),'not a rollout directory');await writeFile(join(root,'history.jsonl'),'invalid history');
 return {root,config,first};
}
const query=(root,extra=[])=>run(['--provenance','--codex-dir',root,'--json',...extra]);

test('inventory lists all mappings including unused and missing skills without consulting usage logs',async t=>{
 const {root}=await fixture(t);const report=JSON.parse(query(root).stdout);
 assert.equal(report.schemaVersion,2);assert.equal(report.kind,'skill-provenance-inventory');
 assert.equal(report.sourceInstanceId,'inventory-instance');assert.equal(report.temporalScope,'current_reference_only');
 assert.equal(report.skills.length,3);assert(!('totals' in report));assert(!('windowDays' in report));
 assert.equal(report.skills.find(s=>s.skillKey==='standalone:unused').status,'present');
 assert.equal(report.skills.find(s=>s.skillKey==='standalone:missing').status,'missing');
 assert.equal(report.skills.find(s=>s.skillKey==='standalone:sample').paths[0].metadata.originalAuthors.values[0].value[0],'作者团队');
 assert(!JSON.stringify(report).includes(root));
 const env=run(['--provenance','--json'],true,{env:{...process.env,CODEX_HOME:root}});
 assert.equal(JSON.parse(env.stdout).sourceInstanceId,'inventory-instance');
});

test('table limit only hides mapped entries; JSON export is complete UTF-8 and query is read-only',async t=>{
 const {root,first}=await fixture(t),config=join(root,'usage-skills','config.json');
 const before=await readFile(config),skillBefore=await readFile(first);
 const table=run(['--provenance','--codex-dir',root,'--limit','1']).stdout;
 assert.match(table,/Skill 出处清单/);assert.match(table,/2 more skills/);
 const output=join(root,'输出','出处.json');
 assert.equal(query(root,['--limit','1','--output',output]).stdout,'');
 const bytes=await readFile(output);assert.notDeepEqual([...bytes.subarray(0,3)],[239,187,191]);
 assert.equal(JSON.parse(bytes).skills.length,3);assert.match(bytes.toString('utf8'),/作者团队/);
 assert.deepEqual(await readFile(config),before);assert.deepEqual(await readFile(first),skillBefore);
});

test('same names stay separate, multiple existing paths are ambiguous and names-only registrations are unmapped',async t=>{
 const {root,config,first}=await fixture(t);
 const copy=await skill(join(root,'other'),'sample','另一团队');
 config.skills.push({skillKey:'manual:duplicate',names:['sample'],paths:[copy]});
 config.skills.push({skillKey:'manual:multi',names:['multi'],paths:[first,copy]});
 config.skills.push({skillKey:'registered:no-file',names:['no-file'],paths:[]});
 const malformed=join(root,'malformed','SKILL.md');await mkdir(dirname(malformed));await writeFile(malformed,Buffer.from([255,254]));
 config.skills.push({skillKey:'manual:malformed',names:['malformed'],paths:[malformed]});
 await writeFile(join(root,'usage-skills','config.json'),JSON.stringify(config));
 const report=JSON.parse(query(root).stdout);assert.equal(report.skills.length,7);
 const multi=report.skills.find(s=>s.skillKey==='manual:multi');assert.equal(multi.status,'ambiguous');assert.equal(multi.paths.length,2);
 assert.notEqual(multi.paths[0].pathId,multi.paths[1].pathId);
 assert.equal(report.skills.find(s=>s.skillKey==='registered:no-file').status,'unmapped');
 const invalid=report.skills.find(s=>s.skillKey==='manual:malformed');assert.equal(invalid.status,'present');assert.equal(invalid.paths[0].metadata,null);
 assert(report.diagnostics.invalidMetadata>0);
});

test('user declarations attach by exact mapped identity and preserve file conflicts without inventing entries',async t=>{
 const {root}=await fixture(t),map=join(root,'declarations.json');
 await writeFile(map,JSON.stringify({version:1,entries:[
  {installationId:'standalone:sample',originalAuthors:['用户声明'],license:'Proprietary'},
  {installationId:'registered:not-mapped',aliases:['sample'],publisher:'某团队'},
 ]}));
 const report=JSON.parse(query(root,['--provenance-map',map]).stdout),sample=report.skills.find(s=>s.skillKey==='standalone:sample');
 assert.equal(sample.paths[0].metadata.originalAuthors.status,'conflict');assert.equal(sample.paths[0].metadata.license.status,'conflict');
 assert.equal(sample.declarations.originalAuthors.values[0].evidence,'user_declared');
 assert.equal(report.skills.length,3);assert.equal(report.diagnostics.unmatchedMappings,1);
});

test('mapped plugin reads adjacent package declarations without enumerating unregistered siblings or leaking email',async t=>{
 const {root,config}=await fixture(t),pluginRoot=join(root,'plugin');
 await mkdir(join(pluginRoot,'.codex-plugin'),{recursive:true});
 const file=await skill(join(pluginRoot,'skills'),'plugin-demo');await skill(join(pluginRoot,'skills'),'unregistered');
 await writeFile(join(pluginRoot,'.codex-plugin','plugin.json'),JSON.stringify({name:'docs',version:'1.0',skills:'./skills/',author:{name:'发行方',email:'secret@example.test'},license:'MIT'}));
 config.skills.push({skillKey:'plugin:docs@1.0:0123456789abcdef:plugin-demo',names:['docs:plugin-demo'],
  paths:[process.platform==='win32'?file.replace(/([\\/])skills([\\/])/i,'$1SKILLS$2'):file]});
 await writeFile(join(root,'usage-skills','config.json'),JSON.stringify(config));
 const report=JSON.parse(query(root).stdout),item=report.skills.find(s=>s.skillKey.startsWith('plugin:')).paths[0].metadata;
 assert.equal(report.skills.length,4);assert.equal(item.version,'1.0');assert.equal(item.publisher.values[0].value,'发行方');
 assert.equal(item.distribution.status,'unknown');assert(!JSON.stringify(report).includes('secret@example.test'));
});

test('usage filters and old discovery roots are rejected before metadata/config reads or export writes',async t=>{
 const {root}=await fixture(t),output=join(root,'must-not-exist.json');
 for(const extra of [['--days','30'],['--strict'],['--markdown'],['--skill-root',root],['--plugin-root',root],['--mcp'],['--hooks'],['--skill-method','logs']]){
  run(['--provenance','--codex-dir',join(root,'absent'),'--json','--output',output,...extra],false);
  await assert.rejects(readFile(output),{code:'ENOENT'});
 }
 const migrated=run(['--provenance','--skill-root',root],false);assert.match(migrated.stderr,/skills refresh/);
});

test('missing or invalid mapping provides setup/validation errors and never echoes sensitive input',async t=>{
 const {root}=await fixture(t);
 assert.match(run(['--provenance','--codex-dir',join(root,'absent')],false).stderr,/setup/);
 const map=join(root,'private-map.json');await writeFile(map,'{"private":"never-echo-this"}');
 assert(!queryError(['--provenance','--codex-dir',root,'--provenance-map',map]).includes('never-echo-this'));
 function queryError(args){return run(args,false).stderr;}
});

test('linked path is unresolved and metadata is not followed',async t=>{
 const {root,config,first}=await fixture(t),linked=join(root,'linked','SKILL.md');
 try{await symlink(dirname(first),dirname(linked),'junction');}catch(error){if(error.code==='EPERM'){t.skip('Symlink privilege is unavailable');return;}throw error;}
 config.skills.push({skillKey:'manual:linked',names:['linked'],paths:[linked]});
 await writeFile(join(root,'usage-skills','config.json'),JSON.stringify(config));
 const report=JSON.parse(query(root).stdout),entry=report.skills.find(s=>s.skillKey==='manual:linked');
 assert.equal(entry.status,'unresolved');assert.equal(entry.paths[0].status,'skipped_link');assert.equal(entry.paths[0].metadata,null);
});
