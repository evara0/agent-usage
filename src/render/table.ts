import Table from 'cli-table3';
import pc from 'picocolors';
import type { AggregateResult } from '../aggregate.js';

interface RenderOptions {
  limit: number;
  days?: number;
  filesScanned: number;
  elapsedMs: number;
}

export function renderTable(result: AggregateResult, opts: RenderOptions): string {
  const rows = opts.limit > 0 ? result.skills.slice(0, opts.limit) : result.skills;
  const table = new Table({
    head: ['Skill', 'Total', 'Explicit', 'Inferred', 'Last recorded'].map(h => pc.bold(h)),
    style: { head: [], border: [] },
    colAligns: ['left', 'right', 'right', 'right', 'left'],
  });
  for (const s of rows) {
    table.push([s.skill, s.total, s.total - s.inferredAuto, s.inferredAuto, s.lastUsedAt ?? '-']);
  }
  const inferred = result.skills.reduce((n, s) => n + s.inferredAuto, 0);
  const lines = [table.toString()];
  const hidden = result.skills.length - rows.length;
  if (hidden) lines.push(`  ... and ${hidden} more skills (use --limit 0 to show all)`);
  lines.push(`  ${result.totals.invocations} records · ${result.totals.invocations - inferred} explicit / ${inferred} inferred · ${result.totals.skills} skills · ${opts.days ? `last ${opts.days}d` : 'all time'} · source: codex`);
  lines.push(`  ${opts.filesScanned} candidate paths in ${(opts.elapsedMs / 1000).toFixed(1)}s (includes history path even if missing)`);
  lines.push('  Inferred = static SKILL.md reads; exclude with --strict. Records do not prove successful execution.');
  return lines.join('\n');
}
