import Table from 'cli-table3';
import type { McpAggregateResult } from '../contracts.js';
import type { McpScanResult } from '../adapters/mcp.js';

interface RenderOptions {
  limit: number;
  days?: number;
  elapsedMs: number;
  scan: Omit<McpScanResult, 'events'>;
}

const singleLine = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ');

/** 只呈现已有聚合；均值仅基于观测耗时样本，未知结果单列。 */
export function renderMcpTable(result: McpAggregateResult, opts: RenderOptions): string {
  const rows = opts.limit > 0 ? result.tools.slice(0, opts.limit) : result.tools;
  const table = new Table({
    head: ['Server', 'Tool', 'Calls', 'Succeeded', 'Failed', 'Unknown', 'Avg ms'],
    colAligns: ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
    style: { head: [], border: [] },
  });
  for (const tool of rows) {
    table.push([
      tool.server === null ? '-' : singleLine(tool.server), singleLine(tool.tool),
      tool.invocations, tool.succeeded, tool.failed, tool.unknown,
      tool.durationSamples === 0 ? '-' : (tool.totalDurationMs / tool.durationSamples).toFixed(2),
    ]);
  }
  const scan = opts.scan;
  const hidden = result.tools.length - rows.length;
  const lines = [table.toString()];
  if (hidden) lines.push(`  ... and ${hidden} more tools (use --limit 0 to show all)`);
  lines.push(
    `  ${result.totals.invocations} MCP calls · ${result.totals.succeeded} succeeded / ${result.totals.failed} failed / ${result.totals.unknown} unknown · ${result.tools.length} tools · ${opts.days === undefined ? 'all time' : `last ${opts.days}d`} · source: codex`,
    `  ${scan.filesRead}/${scan.filesScanned} files read/candidates in ${(opts.elapsedMs / 1000).toFixed(1)}s`,
    `  scan: ${Object.entries(scan).filter(([key]) => key !== 'filesRead' && key !== 'filesScanned').map(([key, value]) => `${key}=${value}`).join(' · ')}`,
    '  Unknown means insufficient result evidence, not success or failure. Avg ms uses observed duration samples only; - means no sample.',
    '  Scan counters cover the entire scan, not just the selected window, and do not prove complete log coverage.',
  );
  return lines.join('\n');
}
