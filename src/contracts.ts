/** MCP JSON version; Skill reports use their independent comparison contract. */
export const USAGE_SCHEMA_VERSION = 1 as const;

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
