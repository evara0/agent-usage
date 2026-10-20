import {
  USAGE_SCHEMA_VERSION,
  type AggregateResult,
  type ReportContext,
  type SkillUsageReport,
} from './contracts.js';

/** 只组装已有统计；不采集、过滤、排序或截断输入。 */
export function createSkillUsageReport(
  result: AggregateResult,
  context: ReportContext,
): SkillUsageReport {
  return {
    schemaVersion: USAGE_SCHEMA_VERSION,
    generatedAt: context.generatedAt,
    source: 'codex',
    windowDays: context.windowDays,
    filesScanned: context.filesScanned,
    elapsedMs: context.elapsedMs,
    totals: result.totals,
    skills: result.skills,
    strict: context.strict,
    timeZone: context.timeZone,
  };
}
