import Table from 'cli-table3';
import type { ProvenanceClaim, SkillInstallation, SkillProvenanceReport } from '../provenance-types.js';

const labels = { file_declared: 'E3 文件声明', user_declared: 'U 用户声明' };
export function claimText<T>(claim: ProvenanceClaim<T>): string {
  if (claim.status === 'unknown') return 'unknown';
  return `${claim.status === 'conflict' ? 'conflict: ' : ''}${claim.values.map(item =>
    `${Array.isArray(item.value) ? item.value.join(', ') : String(item.value)} [${labels[item.evidence]}; ${item.scope}]`).join(' / ')}`;
}
function escape(value: string): string {
  return value.replace(/[\r\n\t\u2028\u2029]+/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/[&<>"'\\`*_\[\]{}()#+!|~:]/g, char => `&#${char.charCodeAt(0)};`);
}
const headings = ['Skill', '关联', '当前身份', '发行方', '原作者', '发行类别', '获取途径', '许可证', '本地状态'];

function values(skill: string, status: string, id: string, item?: SkillInstallation): string[] {
  return [skill, status, id, ...(['publisher', 'originalAuthors', 'distribution', 'acquisition', 'license', 'localState'] as const)
    .map(field => item ? claimText(item[field] as ProvenanceClaim<string | string[]>) : 'unknown')];
}
function rows(report: SkillProvenanceReport, limit = 0): string[][] {
  const associations = limit ? report.associations.slice(0, limit) : report.associations;
  return associations.flatMap(association => association.candidateIds.length
    ? association.candidateIds.map(id => values(association.skill, association.status, id, report.inventory.find(item => item.id === id)))
    : [values(association.skill, association.status, '-')]);
}
const boundary = '仅当前来源候选；E3=文件声明，U=用户声明，均非核验。当前资料不证明历史作者，不按来源重算使用次数。';

export function renderProvenanceMarkdown(report: SkillProvenanceReport): string {
  return ['## Skill 来源资料（当前参考）', '', boundary, '',
    `观察时间：${escape(report.observedAt)}；temporalScope：current_reference_only。`, '',
    '| Skill | 关联 | 当前候选身份 | 未解析别名 |', '| --- | --- | --- | --- |',
    ...report.associations.map(item => `| ${[item.skill, item.status, item.candidateIds.join(', ') || '-',
      item.unresolvedAliases.join(', ') || '-'].map(escape).join(' | ')} |`), '',
    '### 当前资料清单（含未关联项）', '',
    '| 身份 | 类型 | 版本 | 精确名称 | 发行方 | 原作者 | 发行类别 | 获取途径 | 许可证 | 本地状态 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...report.inventory.map(item => `| ${[item.id, item.kind, item.version ?? 'unknown', item.names.join(', '),
      ...values('', '', '', item).slice(3)].map(escape).join(' | ')} |`), '',
    `元数据诊断：${Object.entries(report.diagnostics).map(([key, count]) => `${key}=${count}`).join(', ')}。`,
    '身份仅在本次显式根范围内有效；package/skill/user 标明声明范围，多种许可值需复核其适用范围。', ''].join('\n');
}

export function renderProvenanceTable(report: SkillProvenanceReport, limit = 25): string {
  const table = new Table({ head: headings, wordWrap: true });
  for (const row of rows(report, limit)) table.push(row);
  return ['Skill 来源资料（当前参考）', boundary, table.toString(),
    `metadata: ${Object.entries(report.diagnostics).map(([key, count]) => `${key}=${count}`).join(', ')}`].join('\n');
}
