import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectHookEvents } from '../src/adapters/hooks.js';
import { renderHooksTable } from '../src/render/hooks-table.js';
import type { HookAggregateResult } from '../src/hooks-types.js';

test('Hook table limits rows, preserves totals and distinguishes zero from missing samples', async () => {
  const { scan, coverage } = await collectHookEvents('/synthetic-nonexistent-hook-import');
  const base = { event: 'stop' as const, configSource: 'user' as const, handler: 'command' as const,
    invocations: 1, succeeded: 0, failed: 0, unknown: 1, lastUsedAt: '2026-10-20T00:00:00.000Z',
    totalDurationMs: 0 };
  const result: HookAggregateResult = { hooks: [
    { ...base, hookId: 'a'.repeat(64), durationSamples: 1 },
    { ...base, hookId: 'b'.repeat(64), durationSamples: 0 },
  ], totals: { invocations: 2, succeeded: 0, failed: 0, unknown: 2 } };
  const limited = renderHooksTable(result, { limit: 1, elapsedMs: 0, scan, coverage, days: 30 });
  assert.match(limited, /1 more hooks/);
  assert.match(limited, /2 Hook calls/);
  assert.match(limited, /last 30d/);
  assert.match(limited, /0\.00/);
  assert.doesNotMatch(limited, /bbbbbbbbbbbb/);
  const all = renderHooksTable(result, { limit: 0, elapsedMs: 0, scan, coverage });
  assert.match(all, /bbbbbbbbbbbb/);
  assert.match(all, /\|\s+0\s+│\s+-\s+│|│\s+0\s+│\s+-\s+│/);
  assert.match(all, /source: codex/);
  assert.match(all, /native persistence unverified/);
  assert.match(all, /observed duration samples only/);
  assert.match(all, /entire scan/);
});
