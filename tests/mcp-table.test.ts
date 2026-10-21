import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { McpAggregateResult } from '../src/contracts.js';
import { renderMcpTable } from '../src/render/mcp-table.js';

const scan = {
  filesScanned: 2, filesRead: 1, unreadableFiles: 1, missingDirectories: 0, directoryErrors: 0,
  malformedLines: 1, invalidSignals: 0, missingSessionFiles: 0, duplicateCalls: 0,
  conflictingCalls: 0, orphanResults: 0, ambiguousResults: 0,
};

function fixture(): McpAggregateResult {
  return {
    tools: [
      { server: 'demo', tool: 'observed-zero', invocations: 1, succeeded: 1, failed: 0, unknown: 0,
        lastUsedAt: '2026-10-20T08:00:00Z', durationSamples: 1, totalDurationMs: 0 },
      { server: null, tool: 'no-sample', invocations: 1, succeeded: 0, failed: 0, unknown: 1,
        lastUsedAt: '2026-10-20T08:00:00Z', durationSamples: 0, totalDurationMs: 0 },
    ],
    totals: { invocations: 2, succeeded: 1, failed: 0, unknown: 1 },
  };
}

test('MCP table distinguishes absent duration from observed zero and exposes scan quality', () => {
  const input = fixture();
  const before = structuredClone(input);
  const text = renderMcpTable(input, { limit: 0, elapsedMs: 10, scan });
  assert.ok(text.split('\n').find(line => line.includes('observed-zero'))?.includes('0.00'));
  assert.ok(!text.split('\n').find(line => line.includes('no-sample'))?.includes('0.00'));
  assert.match(text, /2 MCP calls · 1 succeeded \/ 0 failed \/ 1 unknown/);
  assert.match(text, /1\/2 files read\/candidates/);
  assert.match(text, /unreadableFiles=1/);
  assert.match(text, /malformedLines=1/);
  assert.doesNotMatch(text, /NaN|Infinity/);
  assert.deepEqual(input, before);
});

test('MCP row limit leaves full summary intact and empty results remain readable', () => {
  const text = renderMcpTable(fixture(), { limit: 1, days: 7, elapsedMs: 10, scan });
  assert.match(text, /1 more tools/);
  assert.doesNotMatch(text, /no-sample/);
  assert.match(text, /2 MCP calls/);
  assert.match(text, /last 7d/);
  const empty = renderMcpTable({ tools: [], totals: { invocations: 0, succeeded: 0, failed: 0, unknown: 0 } },
    { limit: 25, elapsedMs: 0, scan });
  assert.match(empty, /0 MCP calls/);
  assert.match(empty, /all time/);
  assert.doesNotMatch(empty, /NaN|undefined/);
});

test('MCP terminal values cannot inject newlines or escape control sequences', () => {
  const input = fixture();
  input.tools[0]!.tool = 'line\nforged\u001b[31m\u2028end';
  input.tools[0]!.server = 'server\rname';
  const text = renderMcpTable(input, { limit: 1, elapsedMs: 0, scan });
  assert.ok(!text.includes('line\nforged'));
  assert.ok(!text.includes('\u001b'));
  assert.ok(!text.includes('\u2028'));
  assert.match(text, /server name/);
});
