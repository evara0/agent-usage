import Table from 'cli-table3';
import type { HookAggregateResult, HookScanResult } from '../hooks-types.js';

export function renderHooksTable(result: HookAggregateResult, opts: Omit<HookScanResult, 'records'> & {
  limit: number; days?: number; elapsedMs: number;
}): string {
  const rows = opts.limit > 0 ? result.hooks.slice(0, opts.limit) : result.hooks;
  const table = new Table({ head: ['Hook ID', 'Event', 'Config source', 'Handler', 'Calls', 'Succeeded', 'Failed', 'Unknown', 'Samples', 'Avg ms'],
    colAligns: ['left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right'], style: { head: [], border: [] } });
  for (const h of rows) table.push([h.hookId.slice(0, 12), h.event, h.configSource, h.handler,
    h.invocations, h.succeeded, h.failed, h.unknown, h.durationSamples,
    h.durationSamples ? (h.totalDurationMs / h.durationSamples).toFixed(2) : '-']);
  const lines = [table.toString()];
  const hidden = result.hooks.length - rows.length;
  if (hidden) lines.push(`  ... and ${hidden} more hooks (use --limit 0 to show all)`);
  lines.push(
    `  ${result.totals.invocations} Hook calls · ${result.totals.succeeded} succeeded / ${result.totals.failed} failed / ${result.totals.unknown} unknown · ${result.hooks.length} hooks · ${opts.days === undefined ? 'all time' : `last ${opts.days}d`} · source: codex`,
    `  ${opts.scan.filesRead}/${opts.scan.filesScanned} files read/candidates in ${(opts.elapsedMs / 1000).toFixed(1)}s`,
    `  scan: ${Object.entries(opts.scan).filter(([k]) => k !== 'filesRead' && k !== 'filesScanned').map(([k, v]) => `${k}=${v}`).join(' · ')}`,
    `  coverage: ${opts.coverage.availability}; native persistence unverified; async not covered.`,
    ...opts.coverage.notes.map(note => `  ${note}`),
    '  Unknown is not success/failure. Avg ms uses observed duration samples only; - means no sample.',
    '  Scan counters cover the entire scan, not just the selected window, and do not prove complete coverage.',
  );
  return lines.join('\n');
}
