import type { McpAggregateResult, McpCallRecord, McpToolStats } from './contracts.js';

export interface McpAggregateOptions {
  /** Rolling N × 24 hours, inclusive at the start boundary. Omit for all history. */
  days?: number;
}

/** @internal Shared strict timestamp parser; local timestamps and invalid calendar dates are rejected. */
export function parseMcpTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1]!
      || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validate(record: McpCallRecord): McpCallRecord {
  if (!record || record.source !== 'codex' || !nonempty(record.sessionId)
      || !nonempty(record.callId) || !nonempty(record.tool)
      || (record.server !== null && !nonempty(record.server))) {
    throw new TypeError('Invalid MCP call identity');
  }
  const startedAt = parseMcpTimestamp(record.startedAt);
  if (!startedAt) throw new TypeError('Invalid MCP startedAt');
  if (record.status === 'unknown') {
    if (record.finishedAt !== null || record.durationMs !== null) {
      throw new TypeError('Unknown MCP calls must not have a finish time or duration');
    }
    return { ...record, startedAt };
  }
  if (record.status !== 'succeeded' && record.status !== 'failed') throw new TypeError('Invalid MCP status');
  const finishedAt = parseMcpTimestamp(record.finishedAt);
  if (!finishedAt || Date.parse(finishedAt) < Date.parse(startedAt)) throw new TypeError('Invalid MCP finishedAt');
  if (record.durationMs !== null && (typeof record.durationMs !== 'number'
      || !Number.isFinite(record.durationMs) || record.durationMs < 0)) throw new TypeError('Invalid MCP duration');
  return { ...record, startedAt, finishedAt };
}

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Aggregate snapshots of calls, deduplicating by source/sessionId/callId, without mutating input. */
export function aggregateMcpEvents(records: McpCallRecord[], opts: McpAggregateOptions = {}): McpAggregateResult {
  if (opts.days !== undefined && (!Number.isFinite(opts.days) || opts.days <= 0)) {
    throw new RangeError('days must be a positive finite number');
  }
  const cutoff = opts.days === undefined ? null : Date.now() - opts.days * 86_400_000;
  const byIdentity = new Map<string, McpCallRecord[]>();
  for (const input of records) {
    const record = validate(input);
    const key = JSON.stringify([record.source, record.sessionId, record.callId]);
    const group = byIdentity.get(key) ?? [];
    group.push(record);
    byIdentity.set(key, group);
  }
  const tools = new Map<string, McpToolStats>();
  for (const group of byIdentity.values()) {
    // Sort copies so conflicts are resolved deterministically, regardless of replay order.
    group.sort((a, b) => compare(a.tool, b.tool) || compare(a.server ?? '', b.server ?? '') || compare(a.startedAt, b.startedAt));
    const first = group[0]!;
    const startedAt = group.map(r => r.startedAt).sort()[0]!;
    if (cutoff !== null && Date.parse(startedAt) < cutoff) continue;
    const servers = new Set(group.flatMap(r => r.server === null ? [] : [r.server]));
    const states = new Set(group.filter(r => r.status !== 'unknown').map(r => r.status));
    const conflict = new Set(group.map(r => r.tool)).size > 1 || servers.size > 1 || states.size > 1;
    const status = conflict || states.size === 0 ? 'unknown' : [...states][0]!;
    const durations = new Set(group.flatMap(r => r.durationMs === null ? [] : [r.durationMs]));
    const duration = status !== 'unknown' && durations.size === 1 ? [...durations][0]! : null;
    const server = servers.size === 1 ? [...servers][0]! : null;
    const key = JSON.stringify([server, first.tool]);
    let stats = tools.get(key);
    if (!stats) {
      stats = { server, tool: first.tool, invocations: 0, succeeded: 0, failed: 0, unknown: 0,
        lastUsedAt: null, durationSamples: 0, totalDurationMs: 0 };
      tools.set(key, stats);
    }
    stats.invocations += 1;
    stats[status] += 1;
    if (stats.lastUsedAt === null || startedAt > stats.lastUsedAt) stats.lastUsedAt = startedAt;
    if (duration !== null) {
      stats.durationSamples += 1;
      stats.totalDurationMs += duration;
      if (!Number.isFinite(stats.totalDurationMs)) throw new RangeError('MCP total duration overflow');
    }
  }
  const sorted = [...tools.values()].sort((a, b) => b.invocations - a.invocations
    || compare(a.server ?? '', b.server ?? '') || compare(a.tool, b.tool));
  const totals = { invocations: 0, succeeded: 0, failed: 0, unknown: 0 };
  for (const stats of sorted) {
    totals.invocations += stats.invocations;
    totals.succeeded += stats.succeeded;
    totals.failed += stats.failed;
    totals.unknown += stats.unknown;
  }
  return { tools: sorted, totals };
}
