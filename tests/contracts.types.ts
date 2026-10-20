import type { McpCallRecord, SkillUsageReport } from '../src/contracts.js';

// 本文件由 pnpm run test 的 TypeScript 编译检查，不作为运行时测试执行。
const identity = {
  source: 'codex', sessionId: 'synthetic', callId: 'call-1', server: null,
  tool: 'mcp__demo__read', startedAt: '2026-10-20T08:00:00.000Z',
} as const;

// @ts-expect-error 未知结果不能伪造零耗时。
const unknownWithDuration: McpCallRecord = { ...identity, status: 'unknown', finishedAt: null, durationMs: 0 };
// @ts-expect-error 成功结果必须包含已关联的结果时间。
const successWithoutResult: McpCallRecord = { ...identity, status: 'succeeded', finishedAt: null, durationMs: null };
// @ts-expect-error 调用身份必须包括会话，不能仅靠 callId。
const missingSession: McpCallRecord = { source: 'codex', callId: 'call-1', server: null, tool: 'read', startedAt: identity.startedAt, status: 'unknown', finishedAt: null, durationMs: null };

declare const report: SkillUsageReport;
// @ts-expect-error 报告来源保持 Codex，不隐式扩展为其他 Agent。
const otherSource: 'claude' = report.source;

void unknownWithDuration;
void successWithoutResult;
void missingSession;
void otherSource;
