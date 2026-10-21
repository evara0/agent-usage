import { HOOK_EVENTS, HOOK_SOURCES, type HookAggregateResult, type HookRecord, type HookStats } from './hooks-types.js';

const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const iso = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-/.test(value) && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
function validate(r: HookRecord): HookRecord {
  if (!r || r.source !== 'codex' || !/^[a-f0-9]{64}$/.test(r.identity) || !/^[a-f0-9]{64}$/.test(r.hookId)
      || !HOOK_EVENTS.includes(r.event) || !HOOK_SOURCES.includes(r.configSource)
      || !['command', 'mcpTool'].includes(r.handler) || !iso(r.startedAt)
      || !['succeeded', 'failed', 'unknown'].includes(r.status)
      || (r.finishedAt !== null && (!iso(r.finishedAt) || r.finishedAt < r.startedAt))
      || (r.status !== 'unknown' && r.finishedAt === null)
      || (r.durationMs !== null && (!Number.isSafeInteger(r.durationMs) || r.durationMs < 0 || r.finishedAt === null))) {
    throw new TypeError('Invalid Hook record');
  }
  return r;
}

/** Merge snapshots before filtering; unknown snapshots may be completed by explicit evidence. */
export function aggregateHookEvents(records: HookRecord[], opts: { days?: number } = {}): HookAggregateResult {
  if (opts.days !== undefined && (!Number.isFinite(opts.days) || opts.days <= 0)) throw new RangeError('days must be positive and finite');
  const cutoff = opts.days === undefined ? null : Date.now() - opts.days * 86_400_000;
  const identities = new Map<string, HookRecord[]>();
  for (const input of records) {
    const r = validate(input);
    const group = identities.get(r.identity) ?? [];
    group.push(r);
    identities.set(r.identity, group);
  }
  const hooks = new Map<string, HookStats>();
  for (const group of identities.values()) {
    group.sort((a, b) => lexical(a.hookId, b.hookId) || lexical(a.event, b.event)
      || lexical(a.configSource, b.configSource) || lexical(a.handler, b.handler) || lexical(a.startedAt, b.startedAt));
    const r = group[0]!;
    const startedAt = group.map(v => v.startedAt).sort()[0]!;
    if (cutoff !== null && Date.parse(startedAt) < cutoff) continue;
    const terminals = group.filter(v => v.finishedAt !== null);
    const states = new Set(terminals.map(v => v.status));
    const conflict = new Set(group.map(v => JSON.stringify([v.hookId, v.event, v.configSource, v.handler, v.startedAt]))).size > 1
      || states.size > 1 || new Set(terminals.map(v => v.finishedAt)).size > 1;
    const status = conflict || !states.size ? 'unknown' : [...states][0]!;
    const durations = new Set(group.flatMap(v => v.durationMs === null ? [] : [v.durationMs]));
    const duration = !conflict && durations.size === 1 ? [...durations][0]! : null;
    const key = JSON.stringify([r.hookId, r.event, r.configSource, r.handler]);
    let stats = hooks.get(key);
    if (!stats) {
      stats = { hookId: r.hookId, event: r.event, configSource: r.configSource, handler: r.handler,
        invocations: 0, succeeded: 0, failed: 0, unknown: 0, lastUsedAt: startedAt, durationSamples: 0, totalDurationMs: 0 };
      hooks.set(key, stats);
    }
    stats.invocations++;
    stats[status]++;
    if (startedAt > stats.lastUsedAt) stats.lastUsedAt = startedAt;
    if (duration !== null) {
      stats.durationSamples++;
      stats.totalDurationMs += duration;
      if (!Number.isSafeInteger(stats.totalDurationMs)) throw new RangeError('Hook total duration overflow');
    }
  }
  const sorted = [...hooks.values()].sort((a, b) => b.invocations - a.invocations || lexical(a.hookId, b.hookId)
    || lexical(a.event, b.event) || lexical(a.configSource, b.configSource) || lexical(a.handler, b.handler));
  const totals = { invocations: 0, succeeded: 0, failed: 0, unknown: 0 };
  for (const h of sorted) for (const key of ['invocations', 'succeeded', 'failed', 'unknown'] as const) totals[key] += h[key];
  return { hooks: sorted, totals };
}
