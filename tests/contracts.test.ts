import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpAggregateResult, McpCallRecord } from '../src/contracts.js';

test('MCP 合成记录保留跨会话身份、未知结果和零耗时与缺失耗时的区别', () => {
  const identity = {
    source: 'codex', sessionId: 'session-a', callId: 'call-1', server: null,
    tool: 'mcp__demo__read', startedAt: '2026-10-20T08:00:00.000Z',
  } as const;
  const calls: McpCallRecord[] = [
    { ...identity, status: 'unknown', finishedAt: null, durationMs: null },
    { ...identity, sessionId: 'session-b', status: 'succeeded', finishedAt: '2026-10-20T08:00:00.000Z', durationMs: 0 },
    { ...identity, sessionId: 'session-c', status: 'failed', finishedAt: '2026-10-20T08:00:00.000Z', durationMs: null },
  ];
  assert.equal(new Set(calls.map(call => JSON.stringify([call.source, call.sessionId, call.callId]))).size, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), calls);
  assert.equal(calls[0]!.durationMs, null);
  assert.equal(calls[1]!.durationMs, 0);
  assert.equal(calls[2]!.durationMs, null);

  // 仅验证独立结果可表示、可序列化，不实现或冒充 MCP 聚合算法。
  const summary: McpAggregateResult = {
    tools: [{ server: null, tool: identity.tool, invocations: 3, succeeded: 1, failed: 1,
      unknown: 1, lastUsedAt: '2026-10-20T08:00:00.000Z', durationSamples: 1, totalDurationMs: 0 }],
    totals: { invocations: 3, succeeded: 1, failed: 1, unknown: 1 },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), summary);
});
