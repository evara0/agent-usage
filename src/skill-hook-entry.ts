#!/usr/bin/env node
import { runSkillHook } from './skill-hook.js';
import { parseArgs } from 'node:util';

// No stdout decisions, non-zero exit, or raw input on errors: collection is fail-open.
try {
  const {values}=parseArgs({options:{config:{type:'string'},home:{type:'string'},help:{type:'boolean'}},strict:true});
  if(values.help)console.log('Usage: skill-hook --config PATH --home CODEX_HOME < hook-input.json');
  else{
    if(!values.config||!values.home)throw new Error('missing arguments');
    const chunks:Buffer[]=[];let bytes=0;
    for await(const chunk of process.stdin){
      const b=Buffer.from(chunk);bytes+=b.length;
      if(bytes>1024*1024)throw new Error('input too large');
      chunks.push(b);
    }
    await runSkillHook(values.config,values.home,JSON.parse(Buffer.concat(chunks).toString('utf8')));
  }
}catch{
  console.error('agent-usage Skill Hook: collection failed');
}
