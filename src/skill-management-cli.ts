import {parseArgs} from 'node:util';
import {setupSkillCollection} from './skill-setup.js';
import {installSkillHook} from './skill-hook-install.js';

export async function runSkillManagement(argv:string[]):Promise<boolean>{
  let operation:'setup'|'refresh'|'install'|undefined,skip=1;
  if(argv[0]==='setup')operation='setup';
  else if(argv[0]==='skills'&&argv[1]==='refresh'){operation='refresh';skip=2;}
  else if(argv[0]==='hooks'&&argv[1]==='install'){operation='install';skip=2;}
  else if(argv[0]==='skills'||argv[0]==='hooks'){
    console.error('Use agent-usage skills refresh or agent-usage hooks install.');process.exitCode=1;return true;
  }else return false;
  try{
    const {values}=parseArgs({args:argv.slice(skip),strict:true,allowPositionals:false,options:{
      'codex-dir':{type:'string'},'skill-root':{type:'string',multiple:true},'plugin-root':{type:'string',multiple:true},
      'project-root':{type:'string',multiple:true},json:{type:'boolean'},help:{type:'boolean',short:'h'},
    }});
    if(values.help){console.log('Usage: agent-usage setup [--codex-dir DIR] [--project-root DIR] [--skill-root DIR] [--plugin-root DIR]\n'+
      '       agent-usage skills refresh [same roots; repeated options allowed]\n'+
      '       agent-usage hooks install [--codex-dir DIR]\n'+
      'Setup/refresh writes local mapping with backups; hooks install writes user hooks.json and requires normal Codex trust.');return true;}
    for(const key of ['codex-dir','skill-root','plugin-root','project-root'] as const){const value=values[key];
      if(value!==undefined&&(Array.isArray(value)?value:[value]).some(v=>!v.trim()))throw new Error('--'+key+' must not be empty');}
    if(operation==='install'&&(values['skill-root']||values['plugin-root']||values['project-root']))throw new Error('Add discovery roots with setup or skills refresh before hooks install.');
    const result=operation==='install'?await installSkillHook({codexDir:values['codex-dir']}):await setupSkillCollection({
      codexDir:values['codex-dir'],skillRoots:values['skill-root'],pluginRoots:values['plugin-root'],
      projectRoots:values['project-root'],refresh:operation==='refresh'});
    if(values.json)console.log(JSON.stringify(result,null,2));
    else if('mappedSkills' in result)console.log('Skill mapping '+(result.changed?'saved':'unchanged')+' '+result.configPath+'\n'+
      result.mappedSkills+' mapped skills · '+result.added+' added\n'+
      (result.warnings.length?'Warnings '+result.warnings.map(w=>w.code+' '+w.count).join(', ')+'\n':'')+'Next '+result.next);
    else console.log('Skill Hook '+(result.changed?'registered':'unchanged')+' '+result.hookPath+'\nCollector '+result.collector+
      ('launcher' in result?'\nLauncher '+result.launcher:'')+'\n'+result.next);
  }catch(e){console.error(e instanceof Error?e.message:'Unable to configure Skill collection');process.exitCode=1;}
  return true;
}
