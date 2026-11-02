import type { SkillComparisonReport } from '../skill-evidence-types.js';
import { skillEvidenceInView } from '../skill-evidence.js';
import { displaySkillTime } from './skill-comparison.js';

/** Keep untrusted labels in one text cell, never a Markdown/HTML instruction. */
function escapeText(value:string):string{
  return value.replace(/[\r\n\t\u2028\u2029]+/g,' ').replace(/[\u0000-\u001f\u007f]/g,'')
    .replace(/[&<>"'\\`*_\[\]{}()#+!|~:]/g,char=>'&#'+char.charCodeAt(0)+';');
}
const count=(value:number|null)=>value===null?'—':String(value);

/** Pure full-report rendering; collection, policy, time filtering and dedup stay upstream. */
export function renderMarkdown(report:SkillComparisonReport):string{
  const mode=report.mode==='combined'?'Logs + Hooks':report.mode==='logs'?'Logs':'Hooks';
  const policy=report.countPolicy??'strict';
  const period=report.period.start===null?'All time':displaySkillTime(report.period.start,report.timeZone)+' — '+displaySkillTime(report.period.end,report.timeZone);
  const unresolved=report.deduplication.unresolvedEvidence.flatMap(u=>u.evidence.filter(e=>skillEvidenceInView(e,report)));
  const lines=[
    '# Codex Skill 使用报告','',
    '- Mode '+mode,
    '- Counts '+(policy==='resolved'?'Resolved evidence':'Strict'),
    '- Count Unit skill-turn',
    '- Period '+escapeText(period),
    '- Time Zone '+escapeText(report.timeZone),
    '- Generated At '+escapeText(report.generatedAt),
    '',
    '| Skill | Logs Explicit | Logs Inferred | Hooks | Unique Total | Last Recorded |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
  ];
  for(const row of report.skills)lines.push('| '+[escapeText(row.skill),count(row.logsExplicit),count(row.logsInferred),
    count(row.hooks),count(row.uniqueTotal),displaySkillTime(row.lastRecorded,report.timeZone)].join(' | ')+' |');
  if(!report.skills.length)lines.push('','当前统计范围内没有身份完整的 Skill 记录。');
  lines.push('',count(report.totals.uniqueTotal)+' skill-turns · '+count(report.totals.skills)+' skills');
  if(unresolved.length)lines.push('','Unresolved candidates '+unresolved.length,
    policy==='resolved'?'仅统计身份完整的证据；未决候选保留在 JSON，不计入上表。':'受未决候选影响的严格计数显示 —；不将未知视为零。');
  lines.push('','## 统计口径','',
    '- 按同实例、会话、轮次、技能归组；Unique Total 是所选来源的并集，同轮同技能计一次。',
    '- — 表示未选择来源或无法确定的严格计数；0 表示当前口径下已知为零。',
    '- 记录表示指定、注入或读取尝试，不代表技能执行成功或完整历史覆盖。',
    '- 本报告展示上游报告的全部技能；--limit 不截断 Markdown。','');
  return lines.join('\n');
}
