import type { SkillProvenanceReport } from './provenance-types.js';

/** 首个公共报告版本；不兼容的字段或口径变更必须提升版本。 */
export const USAGE_SCHEMA_VERSION = 1 as const;

export interface SkillStats {
  skill: string;
  total: number;
  manual: number;
  auto: number;
  /** auto 中由静态 SKILL.md 读取推断的子集，不代表成功执行。 */
  inferredAuto: number;
  lastUsedAt: string | null;
  sources: Record<string, number>;
  /** 运行机器本地日期 YYYY-MM-DD。 */
  daily: Record<string, number>;
  projects: Record<string, number>;
  aliases: string[];
}

export interface AggregateResult {
  skills: SkillStats[];
  totals: { invocations: number; manual: number; auto: number; skills: number };
}

export interface ReportContext {
  /** 调用方提供的 ISO 8601 生成时间。 */
  generatedAt: string;
  /** 滚动 N×24 小时；null 表示全部历史。 */
  windowDays: number | null;
  strict: boolean;
  /** daily 分桶使用的运行机器本地 IANA 时区。 */
  timeZone: string;
  /** 既有候选 rollout 数加 history 路径，不是成功读取数。 */
  filesScanned: number;
  elapsedMs: number;
}

export interface SkillUsageReport extends ReportContext, AggregateResult {
  schemaVersion: typeof USAGE_SCHEMA_VERSION;
  source: 'codex';
  /** Opt-in current references, never historical authorship attribution. */
  provenance?: SkillProvenanceReport;
}

interface McpCallIdentity {
  source: 'codex';
  /** 调用身份为 source/sessionId/callId，不能只使用 callId。 */
  sessionId: string;
  callId: string;
  /** 无可靠映射时为 null，不从模糊名称猜测。 */
  server: string | null;
  tool: string;
  /** 调用尝试的 ISO 8601 时间。 */
  startedAt: string;
}

/** 类型约束由后续采集器兑现；本模块不解析或验证真实日志。 */
export type McpCallRecord = McpCallIdentity & (
  | {
      status: 'unknown';
      finishedAt: null;
      durationMs: null;
    }
  | {
      /** 仅有明确结果证据才能设置成功或失败。 */
      status: 'succeeded' | 'failed';
      /** 已关联结果的 ISO 8601 时间。 */
      finishedAt: string;
      /** 可靠的非负有限耗时；缺失用 null，0 只表示观测到零耗时。 */
      durationMs: number | null;
    }
);

export interface McpCounts {
  /** invocations = succeeded + failed + unknown。 */
  invocations: number;
  succeeded: number;
  failed: number;
  unknown: number;
}

export interface McpToolStats extends McpCounts {
  server: string | null;
  tool: string;
  /** 最新调用开始时间。 */
  lastUsedAt: string | null;
  /** 仅计入有可靠耗时的调用，无样本时为 0。 */
  durationSamples: number;
  /** 耗时样本之和；无样本时为 0，不表示全部调用耗时为零。 */
  totalDurationMs: number;
}

export interface McpAggregateResult {
  tools: McpToolStats[];
  totals: McpCounts;
}
