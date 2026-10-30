import Table from 'cli-table3';
import type { SkillComparisonReport } from '../skill-evidence-types.js';
import { skillEvidenceInView } from '../skill-evidence.js';

export function displaySkillTime(iso:string|null,timeZone:string):string{
  if(iso===null)return '—';
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));
  const get=(type:string)=>parts.find(p=>p.type===type)?.value;
  return get('year')+'-'+get('month')+'-'+get('day')+' '+get('hour')+':'+get('minute');
}
export function renderSkillComparison(report:SkillComparisonReport,limit=25):string{
  const table=new Table({head:['Skill','Logs Explicit','Logs Inferred','Hooks','Unique Total','Last Recorded'],
    colAligns:['left','right','right','right','right','left'],style:{head:[],border:[]}});
  const rows=limit>0?report.skills.slice(0,limit):report.skills;
  for(const r of rows)table.push([r.skill,r.logsExplicit??'—',r.logsInferred??'—',r.hooks??'—',
    r.uniqueTotal??'—',displaySkillTime(r.lastRecorded,report.timeZone)]);
  const period=report.period.start===null?'All time':
    displaySkillTime(report.period.start,report.timeZone)+' — '+displaySkillTime(report.period.end,report.timeZone);
  const start=report.period.start===null?null:displaySkillTime(report.period.start,report.timeZone);
  const end=report.period.end===null?null:displaySkillTime(report.period.end,report.timeZone);
  const singleDay=start&&end&&start.endsWith('00:00')&&end.endsWith('00:00')&&Date.parse(end.slice(0,10))-Date.parse(start.slice(0,10))===86_400_000;
  const header=singleDay?'Date: '+start!.slice(0,10):'Period: '+period;
  const name=report.mode==='combined'?'Logs + Hooks':report.mode==='logs'?'Logs':'Hooks';
  const unresolved=report.deduplication.unresolvedEvidence.flatMap(u=>u.evidence.filter(e=>skillEvidenceInView(e,report)));
  const missing=new Map<string,number>();
  for(const e of unresolved)for(const [field,label]of [['skillKey','unmapped skill'],['turnId','missing turn'],
    ['sessionId','missing session'],['sourceRecordId','missing record ID'],['occurredAt','missing time']] as const){
    if(e[field]===null)missing.set(label,(missing.get(label)??0)+1);
  }
  const knownGroups=Object.values(report.comparison).reduce((n,list)=>n+list.length,0);
  const diagnostic=unresolved.length?'\nResolved evidence groups '+knownGroups+' · Unresolved candidates '+unresolved.length+
    (missing.size?' ('+[...missing].map(([reason,n])=>reason+' '+n).join(', ')+')':'')+
    '\nSelected counts shown as — are unknown; inspect --json for details.':'';
  return header+'    Mode: '+name+'\n\n'+table.toString()+'\n\n'+
    (report.totals.uniqueTotal??'—')+' skill-turns · '+(report.totals.skills??'—')+' '+(report.totals.skills===1?'skill':'skills')+
    (rows.length<report.skills.length?'\n'+(report.skills.length-rows.length)+' more skills (use --limit 0)':'')+diagnostic;
}
