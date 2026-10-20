#!/usr/bin/env node
import { cli, define } from 'gunshi';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { renderHeader } from 'gunshi/renderer';
import { collectCodexEvents } from './adapters/codex.js';
import { aggregate } from './aggregate.js';
import { renderTable } from './render/table.js';
import { createSkillUsageReport } from './report.js';
import { renderMarkdown } from './render/markdown.js';

const command = define({
  name: 'agent-usage',
  description: 'Local Codex Skill evidence statistics',
  args: {
    json: { type: 'boolean', description: 'Output complete machine-readable JSON' },
    markdown: { type: 'boolean', description: 'Output a complete Skill Markdown report' },
    days: { type: 'number', short: 'd', description: 'Rolling window of N days (positive finite number)' },
    limit: { type: 'number', short: 'l', default: 25, description: 'Maximum table rows (0 = all)' },
    strict: { type: 'boolean', description: 'Exclude inferred SKILL.md reads' },
    'codex-dir': { type: 'string', description: 'Codex home directory (default: ~/.codex)' },
  },
  run: async ctx => {
    if (ctx.positionals.length) throw new Error('Unexpected positional argument; use --help');
    const { days, limit = 25, strict } = ctx.values;
    if (days !== undefined && (!Number.isFinite(days) || days <= 0)) {
      throw new Error('--days must be a positive finite number');
    }
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new Error('--limit must be a non-negative safe integer');
    }
    const started = performance.now();
    const scan = await collectCodexEvents(ctx.values['codex-dir']);
    const result = aggregate(scan.events, { days, strict });
    const elapsedMs = performance.now() - started;
    if (ctx.values.json || ctx.values.markdown) {
      const report = createSkillUsageReport(result, {
        generatedAt: new Date().toISOString(), windowDays: days ?? null,
        filesScanned: scan.filesScanned, elapsedMs,
        strict: Boolean(strict), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      console.log(ctx.values.markdown ? renderMarkdown(report) : JSON.stringify(report, null, 2));
    } else {
      console.log(renderTable(result, { limit, days, filesScanned: scan.filesScanned, elapsedMs }));
    }
  },
});

const argv = process.argv.slice(2);
// Gunshi ignores undeclared options; validate against the same schema before
// entering the command so invalid arguments can never trigger a data scan.
const options: NonNullable<ParseArgsConfig['options']> = Object.fromEntries(
  Object.entries(command.args).map(([name, schema]) => [name, {
    type: schema.type === 'boolean' ? 'boolean' : 'string',
    ...('short' in schema ? { short: schema.short } : {}),
  }]),
);
options.help = { type: 'boolean', short: 'h' };
options.version = { type: 'boolean', short: 'v' };
try {
  const { values } = parseArgs({ args: argv, options, strict: true, allowPositionals: false });
  if (values.json && values.markdown) throw new Error('--json and --markdown are mutually exclusive');
  if (values.days !== undefined &&
      (typeof values.days !== 'string' || !Number.isFinite(Number(values.days)) || Number(values.days) <= 0)) {
    throw new Error('--days must be a positive finite number');
  }
  if (values.limit !== undefined &&
      (typeof values.limit !== 'string' || !values.limit.trim() ||
       !Number.isSafeInteger(Number(values.limit)) || Number(values.limit) < 0)) {
    throw new Error('--limit must be a non-negative safe integer');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

await cli(argv, command, {
  name: 'agent-usage', version: '0.1.0', description: 'Local Codex Skill evidence statistics',
  renderHeader: async ctx => (ctx.values.json || ctx.values.markdown) && !('help' in ctx.values && ctx.values.help) ? '' : renderHeader(ctx),
});
