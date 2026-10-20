import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { McpCallRecord } from '../contracts.js';
import { parseMcpTimestamp } from '../mcp-aggregate.js';

export interface McpScanResult {
  events: McpCallRecord[];
  /** Candidate JSONL files in sessions + archived_sessions, excluding history.jsonl. */
  filesScanned: number;
  filesRead: number;
  unreadableFiles: number;
  missingDirectories: number;
  directoryErrors: number;
  malformedLines: number;
  invalidSignals: number;
  missingSessionFiles: number;
  /** Extra accepted call signals with the same joint identity, including replays. */
  duplicateCalls: number;
  /** Joint identities with conflicting tool or explicit server metadata. */
  conflictingCalls: number;
  /** Distinct MCP lifecycle result identities without an accepted call. Unattributed outputs are excluded. */
  orphanResults: number;
  /** Call identities with result signals but without an unambiguous explicit outcome. */
  ambiguousResults: number;
}

type ObjectValue = Record<string, unknown>;
interface CallSignal { callId: string; tool: string; server: string | null; time: string }
interface ResultSignal {
  callId: string;
  mcp: boolean;
  tool: string | null;
  server: string | null;
  time: string | null;
  status: 'succeeded' | 'failed' | 'unknown';
  duration: number | null;
}
interface Signals { calls: CallSignal[]; results: ResultSignal[] }

function object(value: unknown): ObjectValue | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as ObjectValue : null;
}
function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function invocation(value: unknown): { tool: string; server: string } | null {
  const data = object(value);
  if (!data || !nonempty(data.server) || !nonempty(data.tool)) return null;
  return { server: data.server, tool: `mcp__${data.server}__${data.tool}` };
}
function outcome(value: unknown): ResultSignal['status'] {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return 'unknown'; }
  }
  const result = object(value);
  // Do not infer success from a nonempty body, default flags, or transport completion.
  return result && Array.isArray(result.content) && typeof result.isError === 'boolean'
    ? result.isError ? 'failed' : 'succeeded' : 'unknown';
}
function durationMs(value: unknown): number | null {
  const duration = object(value);
  if (!duration || typeof duration.secs !== 'number' || !Number.isSafeInteger(duration.secs) || duration.secs < 0
      || typeof duration.nanos !== 'number' || !Number.isInteger(duration.nanos)
      || duration.nanos < 0 || duration.nanos >= 1_000_000_000) return null;
  const ms = duration.secs * 1000 + duration.nanos / 1_000_000;
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/** Read supported rollout signals only. Never executes tools; retains no arguments or result content. */
export async function collectMcpEvents(codexDir?: string): Promise<McpScanResult> {
  const scan: McpScanResult = {
    events: [], filesScanned: 0, filesRead: 0, unreadableFiles: 0, missingDirectories: 0,
    directoryErrors: 0, malformedLines: 0, invalidSignals: 0, missingSessionFiles: 0,
    duplicateCalls: 0, conflictingCalls: 0, orphanResults: 0, ambiguousResults: 0,
  };
  const root = codexDir ?? join(homedir(), '.codex');
  const files: string[] = [];
  for (const dir of ['sessions', 'archived_sessions']) {
    try {
      const entries = await readdir(join(root, dir), { recursive: true, withFileTypes: true });
      files.push(...entries.filter(e => e.isFile() && e.name.endsWith('.jsonl')).map(e => join(e.parentPath, e.name)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') scan.missingDirectories += 1;
      else scan.directoryErrors += 1;
    }
  }
  scan.filesScanned = files.length;
  const calls = new Map<string, CallSignal[]>();
  const results = new Map<string, ResultSignal[]>();
  const sessions = new Map<string, string>();
  for (const file of files.sort()) {
    const parsed = await readSignals(file, scan);
    if (!parsed) continue;
    for (const call of parsed.calls) {
      const key = JSON.stringify(['codex', parsed.sessionId, call.callId]);
      const group = calls.get(key) ?? [];
      group.push(call);
      calls.set(key, group);
      sessions.set(key, parsed.sessionId);
    }
    for (const result of parsed.results) {
      const key = JSON.stringify(['codex', parsed.sessionId, result.callId]);
      const group = results.get(key) ?? [];
      group.push(result);
      results.set(key, group);
    }
  }
  for (const [key, group] of results) if (!calls.has(key) && group.some(r => r.mcp)) scan.orphanResults += 1;
  for (const [key, group] of calls) {
    group.sort((a, b) => lexical(a.tool, b.tool) || lexical(a.server ?? '', b.server ?? '') || lexical(a.time, b.time));
    const first = group[0]!;
    scan.duplicateCalls += group.length - 1;
    const servers = new Set(group.flatMap(c => c.server === null ? [] : [c.server]));
    const conflict = new Set(group.map(c => c.tool)).size > 1 || servers.size > 1;
    if (conflict) scan.conflictingCalls += 1;
    const startedAt = group.map(c => c.time).sort()[0]!;
    const server = servers.size === 1 ? [...servers][0]! : null;
    const base = { source: 'codex' as const, sessionId: sessions.get(key)!, callId: first.callId,
      server, tool: first.tool, startedAt };
    const outputs = results.get(key) ?? [];
    const statuses = new Set(outputs.map(r => r.status));
    const ambiguous = conflict || statuses.size !== 1 || statuses.has('unknown') || outputs.some(r =>
      !r.time || Date.parse(r.time) < Date.parse(startedAt)
      || (r.tool !== null && r.tool !== first.tool) || (r.server !== null && server !== null && r.server !== server));
    if (outputs.length === 0 || ambiguous) {
      if (outputs.length > 0) scan.ambiguousResults += 1;
      scan.events.push({ ...base, status: 'unknown', finishedAt: null, durationMs: null });
    } else {
      const durations = new Set(outputs.flatMap(r => r.duration === null ? [] : [r.duration]));
      scan.events.push({ ...base, status: outputs[0]!.status as 'succeeded' | 'failed',
        finishedAt: outputs.map(r => r.time!).sort()[0]!,
        durationMs: durations.size === 1 ? [...durations][0]! : null });
    }
  }
  scan.events.sort((a, b) => lexical(a.startedAt, b.startedAt) || lexical(a.sessionId, b.sessionId) || lexical(a.callId, b.callId));
  return scan;
}

const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

async function readSignals(file: string, scan: McpScanResult): Promise<(Signals & { sessionId: string }) | null> {
  const signals: Signals = { calls: [], results: [] };
  const sessionIds = new Set<string>();
  const stream = createReadStream(file, 'utf8');
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      let row: ObjectValue | null;
      try { row = object(JSON.parse(line)); } catch { scan.malformedLines += 1; continue; }
      if (!row) { scan.malformedLines += 1; continue; }
      const payload = object(row.payload);
      if (!payload) continue;
      if (row.type === 'session_meta') {
        if (nonempty(payload.id)) sessionIds.add(payload.id);
        else scan.invalidSignals += 1;
        continue;
      }
      const direct = row.type === 'response_item';
      const lifecycle = row.type === 'event_msg';
      const isCall = direct && (payload.type === 'function_call' || payload.type === 'custom_tool_call')
        && nonempty(payload.name) && payload.name.startsWith('mcp__') && payload.name.length > 5;
      const isBegin = lifecycle && payload.type === 'mcp_tool_call_begin';
      const isOutput = direct && (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output');
      const isEnd = lifecycle && payload.type === 'mcp_tool_call_end';
      if (!isCall && !isBegin && !isOutput && !isEnd) continue;
      if (!nonempty(payload.call_id)) { scan.invalidSignals += 1; continue; }
      const time = parseMcpTimestamp(row.timestamp);
      const mapping = isBegin || isEnd ? invocation(payload.invocation) : null;
      if (isCall || isBegin) {
        if (!time || (isBegin && !mapping)) { scan.invalidSignals += 1; continue; }
        signals.calls.push({ callId: payload.call_id, time, server: mapping?.server ?? null,
          tool: mapping?.tool ?? payload.name as string });
      } else {
        if (!time || (isEnd && !mapping)) scan.invalidSignals += 1;
        const result = object(payload.result);
        const status = isEnd ? result && !Object.hasOwn(result, 'Err') ? outcome(result.Ok) : 'unknown' : outcome(payload.output);
        signals.results.push({ callId: payload.call_id, mcp: isEnd, time, tool: mapping?.tool ?? null,
          server: mapping?.server ?? null, status: isEnd && !mapping ? 'unknown' : status,
          duration: isEnd && status !== 'unknown' ? durationMs(payload.duration) : null });
      }
    }
    scan.filesRead += 1;
  } catch {
    scan.unreadableFiles += 1;
    return null;
  } finally {
    lines.close();
    stream.destroy();
  }
  if (sessionIds.size !== 1) { scan.missingSessionFiles += 1; return null; }
  return { ...signals, sessionId: [...sessionIds][0]! };
}
