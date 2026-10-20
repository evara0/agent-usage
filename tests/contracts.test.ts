import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, type AggregateResult as LegacyAggregateResult, type SkillStats as LegacySkillStats } from '../src/aggregate.js';
import type { AggregateResult, McpAggregateResult, McpCallRecord, ReportContext } from '../src/contracts.js';
import { createSkillUsageReport } from '../src/report.js';

const context: ReportContext = {
  generatedAt: '2026-10-20T08:00:00.000Z',
  windowDays: null,
  strict: false,
  timeZone: 'Asia/Shanghai',
  filesScanned: 2,
  elapsedMs: 10,
};

test('报告可序列化且保留全部旧字段，不改动聚合输入', () => {
  const result: LegacyAggregateResult = aggregate([
    { skill: 'manual', fullName: 'manual', mode: 'manual', inferred: false,
      source: 'codex', timestamp: context.generatedAt, sessionId: 's1', cwd: '/demo', sidechain: false },
    { skill: 'inferred', fullName: 'inferred', mode: 'auto', inferred: true,
      source: 'codex', timestamp: context.generatedAt, sessionId: 's1', cwd: '/demo', sidechain: false },
  ]);
  const before = structuredClone(result);
  // 冻结输入，防止组装过程意外改写或排序原有数据。
  for (const skill of result.skills) {
    Object.freeze(skill.daily);
    Object.freeze(skill.projects);
    Object.freeze(skill.sources);
    Object.freeze(skill.aliases);
    Object.freeze(skill);
  }
  Object.freeze(result.skills);
  Object.freeze(result.totals);
  Object.freeze(result);
  Object.freeze(context);

  const report = createSkillUsageReport(result, context);
  const { schemaVersion, strict, timeZone, ...legacy } = JSON.parse(JSON.stringify(report));
  assert.deepEqual(legacy, {
    generatedAt: context.generatedAt, source: 'codex', windowDays: null,
    filesScanned: 2, elapsedMs: 10, totals: before.totals, skills: before.skills,
  });
  assert.equal(schemaVersion, 1);
  assert.equal(strict, false);
  assert.equal(timeZone, 'Asia/Shanghai');
  assert.deepEqual(result, before);
  const oldImport: LegacySkillStats = result.skills[0]!;
  assert.equal(oldImport.total, 1);
});

test('空数据和 strict 窗口元信息不触发推断或重新聚合', () => {
  const result: AggregateResult = { skills: [], totals: { invocations: 0, manual: 0, auto: 0, skills: 0 } };
  const report = createSkillUsageReport(result, {
    ...context, windowDays: 7, strict: true, timeZone: 'UTC', filesScanned: 1,
  });
  assert.deepEqual(report.skills, []);
  assert.equal(report.totals.invocations, 0);
  assert.equal(report.windowDays, 7);
  assert.equal(report.strict, true);
  assert.equal(report.timeZone, 'UTC');
  assert.equal(report.filesScanned, 1);
});

test('MCP 合成记录保留跨会话身份、未知结果和零耗时与缺失耗时的区别', () => {
  const identity = {
    source: 'codex', sessionId: 'session-a', callId: 'call-1', server: null,
    tool: 'mcp__demo__read', startedAt: context.generatedAt,
  } as const;
  const calls: McpCallRecord[] = [
    { ...identity, status: 'unknown', finishedAt: null, durationMs: null },
    { ...identity, sessionId: 'session-b', status: 'succeeded', finishedAt: context.generatedAt, durationMs: 0 },
    { ...identity, sessionId: 'session-c', status: 'failed', finishedAt: context.generatedAt, durationMs: null },
  ];
  assert.equal(new Set(calls.map(call => JSON.stringify([call.source, call.sessionId, call.callId]))).size, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), calls);
  assert.equal(calls[0]!.durationMs, null);
  assert.equal(calls[1]!.durationMs, 0);
  assert.equal(calls[2]!.durationMs, null);

  // 仅验证独立结果可表示、可序列化，不实现或冒充 MCP 聚合算法。
  const summary: McpAggregateResult = {
    tools: [{ server: null, tool: identity.tool, invocations: 3, succeeded: 1, failed: 1,
      unknown: 1, lastUsedAt: context.generatedAt, durationSamples: 1, totalDurationMs: 0 }],
    totals: { invocations: 3, succeeded: 1, failed: 1, unknown: 1 },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), summary);
});
