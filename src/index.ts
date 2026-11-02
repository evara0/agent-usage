#!/usr/bin/env node
import { cli, define } from 'gunshi';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { renderHeader } from 'gunshi/renderer';
import { collectCodexEvents } from './adapters/codex.js';
import { aggregate } from './aggregate.js';
import { renderTable } from './render/table.js';
import { createSkillUsageReport } from './report.js';
import { renderMarkdown } from './render/markdown.js';
import { collectMcpEvents } from './adapters/mcp.js';
import { aggregateMcpEvents } from './mcp-aggregate.js';
import { renderMcpTable } from './render/mcp-table.js';
import { USAGE_SCHEMA_VERSION } from './contracts.js';
import { emitReport } from './output.js';
import { collectMappedSkillProvenance, loadProvenanceMapping } from './provenance.js';
import { renderProvenanceInventory } from './render/provenance.js';
import { collectHookEvents } from './adapters/hooks.js';
import { collectSkillComparison } from './skill-comparison-cli.js';
import { renderSkillComparison } from './render/skill-comparison.js';
import type { SkillMode,SkillCountPolicy } from './skill-evidence-types.js';
import { aggregateHookEvents } from './hooks-aggregate.js';
import { renderHooksTable } from './render/hooks-table.js';
import { runSkillManagement } from './skill-management-cli.js';

if(await runSkillManagement(process.argv.slice(2)))process.exit(process.exitCode??0);

const command = define({
  name: 'agent-usage',
  description: 'Local Codex Skill, MCP and offline Hook evidence statistics. Setup: setup; skills refresh; hooks install.',
  args: {
    'skill-method': { type: 'string', description: 'Skill evidence mode: logs, hooks or combined' },
    'skill-evidence': { type: 'string', description: 'Replay a structured Skill evidence JSON package' },
    'skill-counts': { type: 'string', description: 'Skill count policy: resolved (default) or strict' },
    json: { type: 'boolean', description: 'Output complete machine-readable JSON' },
    markdown: { type: 'boolean', description: 'Output a complete Skill evidence Markdown report (requires --skill-method)' },
    mcp: { type: 'boolean', description: 'Show MCP statistics instead of Skills (table or JSON)' },
    hooks: { type: 'boolean', description: 'Show offline Hook notification statistics (table or JSON)' },
    output: { type: 'string', description: 'Write Markdown or JSON directly to a UTF-8 file (overwrites)' },
    days: { type: 'number', short: 'd', description: 'Rolling window of N days (positive finite number)' },
    limit: { type: 'number', short: 'l', default: 25, description: 'Maximum table rows (0 = all)' },
    strict: { type: 'boolean', description: 'Exclude inferred SKILL.md reads' },
    'codex-dir': { type: 'string', description: 'Codex home directory (default: ~/.codex)' },
    provenance: { type: 'boolean', description: 'List all mapped Skills and current provenance (independent of usage)' },
    'skill-root': { type: 'string', description: 'Moved to skills refresh --skill-root (not a provenance query option)' },
    'plugin-root': { type: 'string', description: 'Moved to skills refresh --plugin-root (not a provenance query option)' },
    'provenance-map': { type: 'string', description: 'Validated version 1 JSON user declarations for --provenance' },
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
    if (ctx.values['skill-method']) {
      try {
        const report = await collectSkillComparison({ method: ctx.values['skill-method'] as SkillMode,
          evidencePath: ctx.values['skill-evidence'], codexDir: ctx.values['codex-dir'], days,
          countPolicy:ctx.values['skill-counts'] as SkillCountPolicy|undefined });
        if (ctx.values.json) await emitReport(JSON.stringify(report, null, 2), ctx.values.output);
        else if(ctx.values.markdown) await emitReport(renderMarkdown(report),ctx.values.output);
        else console.log(renderSkillComparison(report, limit));
      } catch (error) {
        console.error(error instanceof Error && error.message.startsWith('Invalid skill evidence:') ? error.message : 'Unable to collect Skill comparison evidence');
        process.exitCode = 1;
      }
      return;
    }
    if (ctx.values.provenance) {
      try {
        const mapping=ctx.values['provenance-map']?await loadProvenanceMapping(ctx.values['provenance-map']):undefined;
        const report=await collectMappedSkillProvenance({codexDir:ctx.values['codex-dir'],mapping,observedAt:new Date().toISOString()});
        if(ctx.values.json)await emitReport(JSON.stringify(report,null,2),ctx.values.output);
        else console.log(renderProvenanceInventory(report,limit));
      }
      catch (error) {
        console.error(error instanceof Error ? error.message : 'Unable to collect Skill provenance inventory');
        process.exitCode = 1;
      }
      return;
    }
    if (ctx.values.hooks) {
      const { records, scan, coverage } = await collectHookEvents(ctx.values['codex-dir']);
      const result = aggregateHookEvents(records, { days });
      const elapsedMs = performance.now() - started;
      if (ctx.values.json) {
        await emitReport(JSON.stringify({
          schemaVersion: 1, generatedAt: new Date().toISOString(), source: 'codex', kind: 'hooks',
          windowDays: days ?? null, elapsedMs, scan, coverage, totals: result.totals, hooks: result.hooks,
        }, null, 2), ctx.values.output);
      } else console.log(renderHooksTable(result, { limit, days, elapsedMs, scan, coverage }));
      return;
    }
    if (ctx.values.mcp) {
      const { events, ...scan } = await collectMcpEvents(ctx.values['codex-dir']);
      const result = aggregateMcpEvents(events, { days });
      const elapsedMs = performance.now() - started;
      if (ctx.values.json) {
        await emitReport(JSON.stringify({
          schemaVersion: USAGE_SCHEMA_VERSION, generatedAt: new Date().toISOString(),
          source: 'codex', kind: 'mcp', windowDays: days ?? null, elapsedMs,
          scan, totals: result.totals, tools: result.tools,
        }, null, 2), ctx.values.output);
      } else {
        console.log(renderMcpTable(result, { limit, days, elapsedMs, scan }));
      }
      return;
    }
    const scan = await collectCodexEvents(ctx.values['codex-dir']);
    const result = aggregate(scan.events, { days, strict });
    const elapsedMs = performance.now() - started;
    if (ctx.values.json) {
      const report = createSkillUsageReport(result, {
        generatedAt: new Date().toISOString(), windowDays: days ?? null,
        filesScanned: scan.filesScanned, elapsedMs,
        strict: Boolean(strict), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await emitReport(JSON.stringify(report, null, 2), ctx.values.output);
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
  if(values.provenance){
    for(const flag of ['days','strict','markdown'])if(values[flag]!==undefined&&values[flag]!==false)
      throw new Error('--provenance is a current inventory independent of usage; cannot combine with --'+flag);
    for(const flag of ['skill-root','plugin-root'])if(values[flag]!==undefined)
      throw new Error('--provenance reads the local Skill mapping; configure roots with skills refresh --'+flag+' instead');
  }
  if (values['skill-method'] !== undefined) {
    if (!['logs', 'hooks', 'combined'].includes(String(values['skill-method']))) throw new Error('Invalid --skill-method');
    for (const flag of ['mcp','hooks','provenance','strict','skill-root','plugin-root','provenance-map']) {
      if (values[flag] !== undefined && values[flag] !== false) throw new Error('--skill-method cannot combine with --' + flag);
    }
  }
  if (values['skill-evidence'] !== undefined && (!values['skill-method'] || !String(values['skill-evidence']).trim())) throw new Error('--skill-evidence requires --skill-method and a nonempty path');
  if(values['skill-counts']!==undefined&&(!values['skill-method']||!['resolved','strict'].includes(String(values['skill-counts']))))throw new Error('--skill-counts requires --skill-method and resolved or strict');
  if (values.output !== undefined && (!values.json && !values.markdown)) {
    throw new Error('--output requires --json or --markdown');
  }
  if (typeof values.output === 'string' && !values.output.trim()) throw new Error('--output must not be empty');
  if (values.json && values.markdown) throw new Error('--json and --markdown are mutually exclusive');
  if(values.markdown&&!values['skill-method'])throw new Error('--markdown now requires --skill-method logs|hooks|combined; use --skill-counts strict for strict evidence counts (legacy --strict/provenance Markdown is no longer supported)');
  for (const option of ['skill-root', 'plugin-root', 'provenance-map']) {
    if (values[option] !== undefined && (!values.provenance || !String(values[option]).trim())) {
      throw new Error(`--${option} requires --provenance and a nonempty value`);
    }
  }
  if ((values.mcp || values.hooks) && values.provenance) {
    throw new Error(`--provenance applies to Skills only; cannot combine with ${values.hooks ? '--hooks' : '--mcp'}`);
  }
  if (values.hooks && values.mcp) throw new Error('--hooks and --mcp are mutually exclusive');
  if (values.hooks && (values.strict || values.markdown)) {
    throw new Error('--strict and --markdown apply to Skills only; cannot combine with --hooks');
  }
  if (values.mcp && (values.strict || values.markdown)) {
    throw new Error('--strict and --markdown apply to Skills only; cannot combine with --mcp');
  }
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
  name: 'agent-usage', version: '0.1.0', description: 'Local Codex Skill, MCP and offline Hook evidence statistics',
  renderHeader: async ctx => (ctx.values.json || ctx.values.markdown || ctx.values.provenance || ctx.values['skill-method'] || ctx.values.output !== undefined) && !('help' in ctx.values && ctx.values.help) ? '' : renderHeader(ctx),
});
