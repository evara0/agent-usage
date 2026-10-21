import type { SkillUsageReport } from '../contracts.js';
import { renderProvenanceMarkdown } from './provenance.js';

/** 将输入呈现为单行文本，避免 Markdown / HTML 标记改变报告结构。 */
function escapeText(value: string): string {
  return value
    .replace(/[\r\n\t\u2028\u2029]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[&<>"'\\`*_\[\]{}()#+!|~:]/g, char => `&#${char.charCodeAt(0)};`);
}

/** 只呈现完整报告；不采集、过滤、重新聚合事件或修改输入。 */
export function renderMarkdown(report: SkillUsageReport): string {
  const inferred = report.skills.reduce((sum, skill) => sum + skill.inferredAuto, 0);
  const explicit = report.totals.invocations - inferred;
  const window = report.windowDays === null
    ? '全部历史'
    : `最近 ${report.windowDays} 天（滚动 ${report.windowDays}×24 小时，非自然日）`;
  const lines = [
    '# Codex Skill 使用报告',
    '',
    '## 概览',
    '',
    '| 指标 | 数量 |',
    '| --- | ---: |',
    `| 使用记录 | ${report.totals.invocations} |`,
    `| 明确记录 | ${explicit} |`,
    `| 推断记录 | ${inferred} |`,
    `| 手动记录（manual） | ${report.totals.manual} |`,
    `| 自动记录（auto，含推断） | ${report.totals.auto} |`,
    `| Skill 数 | ${report.totals.skills} |`,
    '',
    '## 统计上下文',
    '',
    `- 报告版本（schemaVersion）：${report.schemaVersion}`,
    `- 来源：${escapeText(report.source)}`,
    `- 生成时间：${escapeText(report.generatedAt)}`,
    `- 统计窗口：${window}`,
    `- strict：${report.strict ? 'true（已排除静态读取推断）' : 'false（包含明确与推断记录）'}`,
    `- 日期分桶时区：${escapeText(report.timeZone)}（仅解释 daily 口径，不转换下表 ISO 时间）`,
    `- 候选扫描路径数（filesScanned）：${report.filesScanned}`,
    `- 扫描与聚合耗时（elapsedMs）：${report.elapsedMs} ms`,
    '',
    '## Skill 排名',
    '',
  ];

  if (report.skills.length === 0) {
    lines.push('当前统计范围内没有可用的 Skill 使用记录。');
  } else {
    lines.push(
      '| 排名 | Skill | 记录数 | 明确 | 推断 | 最近记录时间（ISO 8601） |',
      '| ---: | --- | ---: | ---: | ---: | --- |',
    );
    const ranked = [...report.skills]
      .sort((a, b) => b.total - a.total || a.skill.localeCompare(b.skill));
    for (const [index, skill] of ranked.entries()) {
      lines.push(`| ${index + 1} | ${escapeText(skill.skill)} | ${skill.total} | ${skill.total - skill.inferredAuto} | ${skill.inferredAuto} | ${skill.lastUsedAt === null ? '无记录' : escapeText(skill.lastUsedAt)} |`);
    }
  }

  if (report.provenance) lines.push('', renderProvenanceMarkdown(report.provenance));
  lines.push(
    '',
    '## 记录解读与统计限制',
    '',
    '- 明确记录 = total − inferredAuto，包括手动 $skill 和明确的 Skill 注入；推断记录 = inferredAuto，来自受支持的静态 SKILL.md 读取。',
    '- auto 包含明确自动注入和推断记录，inferredAuto 只是 auto 的子集；manual + auto = total。',
    '- 计数反映去重后的使用证据，不代表执行成功次数或任务质量，也不能据此计算成功率；strict 的差值不代表失败数。',
    '- filesScanned 是候选 rollout 文件数加一个 history 路径，即使 history 不存在也加 1，不代表成功读取数或日志覆盖率。',
    '- 统计只覆盖采集器可识别的日志信号；缺失文件和损坏行可能没有记录，去重可能合并证据，也不能可靠区分子 Agent。',
    '- 本报告展示输入中的全部 Skill，不应用表格 limit；窗口与 strict 由上游兑现，渲染器不重新筛选。未展开 daily、projects、sources 和 aliases 明细。',
    '',
  );
  return lines.join('\n');
}
