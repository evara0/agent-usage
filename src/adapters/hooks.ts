import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, win32 } from 'node:path';
import { createInterface } from 'node:readline';
import { HOOK_EVENTS, HOOK_SOURCES, type HookConfigSource, type HookEvent, type HookRecord,
  type HookScanQuality, type HookScanResult } from '../hooks-types.js';

type Obj = Record<string, unknown>;
type Unit = 'unix-ms' | 'unix-s';
interface Signal extends Omit<HookRecord, 'status'> {
  phase: 'started' | 'completed';
  terminal: string | null;
}
const object = (value: unknown): Obj | null => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Obj : null;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function timestamp(value: unknown, unit: Unit): string | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
  const ms = value * (unit === 'unix-s' ? 1000 : 1);
  if (!Number.isSafeInteger(ms) || ms > 253402300799999 || !Number.isFinite(new Date(ms).getTime())) return null;
  return new Date(ms).toISOString();
}

function parseSignal(row: Obj, unit: Unit, scan: HookScanQuality): Signal | null {
  if (row.method !== 'hook/started' && row.method !== 'hook/completed') {
    if (typeof row.method === 'string' && row.method.startsWith('hook/')) scan.unsupportedSignals++;
    return null;
  }
  const params = object(row.params);
  const run = object(params?.run);
  if (!params || !run || !nonempty(params.threadId) || !nonempty(run.id)) { scan.invalidSignals++; return null; }
  // The generated schema describes these handlers, but prompt/agent are not executed.
  if (run.executionMode !== 'sync' || (run.handlerType !== 'command' && run.handlerType !== 'mcpTool')) {
    scan.unsupportedSignals++; return null;
  }
  const event = HOOK_EVENTS.find(e => e === run.eventName);
  const source = run.source === undefined ? 'unknown' : HOOK_SOURCES.find(s => s === run.source);
  const startedAt = timestamp(run.startedAt, unit);
  if (!event || !source || !startedAt || !nonempty(run.sourcePath)
      || (!isAbsolute(run.sourcePath) && !win32.isAbsolute(run.sourcePath))
      || typeof run.displayOrder !== 'number' || !Number.isSafeInteger(run.displayOrder) || run.displayOrder < 0
      || (row.method === 'hook/started' && run.status !== 'running')) {
    scan.invalidSignals++; return null;
  }
  const phase = row.method === 'hook/started' ? 'started' : 'completed';
  let finishedAt: string | null = null;
  let durationMs: number | null = null;
  let terminal: string | null = null;
  if (phase === 'completed') {
    finishedAt = timestamp(run.completedAt, unit);
    terminal = typeof run.status === 'string' ? run.status : 'unknown';
    // Even a completed notification with unusable timing must retain an unknown run.
    if (!finishedAt || finishedAt < startedAt || !['completed', 'failed', 'blocked', 'stopped'].includes(terminal)) {
      scan.invalidSignals++;
      terminal = 'unknown';
      finishedAt = null;
    }
    if (run.durationMs !== null && run.durationMs !== undefined) {
      if (typeof run.durationMs === 'number' && Number.isSafeInteger(run.durationMs) && run.durationMs >= 0) durationMs = run.durationMs;
      else scan.invalidDurations++;
    }
    scan.completedSignals++;
  } else scan.startedSignals++;
  return {
    source: 'codex', identity: hash(['codex', params.threadId, run.id]),
    hookId: hash([hash(run.sourcePath), source, run.displayOrder, event, run.handlerType]),
    event: event as HookEvent, configSource: source as HookConfigSource, handler: run.handlerType,
    startedAt, finishedAt, durationMs, phase, terminal,
  };
}

async function readSignals(file: string, scan: HookScanQuality): Promise<Signal[]> {
  const signals: Signal[] = [];
  const stream = createReadStream(file, 'utf8');
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let first = true;
  let unit: Unit | null = null;
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      let row: Obj | null = null;
      try { row = object(JSON.parse(line)); } catch { /* Count below without retaining the text. */ }
      if (!row) scan.malformedLines++;
      if (first) {
        first = false;
        if (row?.type === 'agent_usage_hook_import' && row.schemaVersion === 1
            && (row.timestampUnit === 'unix-ms' || row.timestampUnit === 'unix-s')) unit = row.timestampUnit;
        continue;
      }
      if (row && unit) {
        const signal = parseSignal(row, unit, scan);
        if (signal) signals.push(signal);
      }
    }
    scan.filesRead++;
    if (!unit) scan.unsupportedFiles++;
    return signals;
  } catch {
    scan.unreadableFiles++;
    return [];
  } finally { lines.close(); stream.destroy(); }
}

/** Offline import only. No config reads, command execution, telemetry or server connections. */
export async function collectHookEvents(codexDir?: string): Promise<HookScanResult> {
  const scan: HookScanQuality = {
    filesScanned: 0, filesRead: 0, missingDirectories: 0, directoryErrors: 0, unreadableFiles: 0,
    unsupportedFiles: 0, malformedLines: 0, invalidSignals: 0, unsupportedSignals: 0,
    startedSignals: 0, completedSignals: 0, duplicateSignals: 0, conflictingRuns: 0,
    ambiguousResults: 0, missingResults: 0, completionOnlyRuns: 0, invalidDurations: 0, conflictingDurations: 0,
  };
  const records: HookRecord[] = [];
  const root = join(codexDir ?? join(homedir(), '.codex'), 'usage-hooks');
  const files: string[] = [];
  try {
    const entries = await readdir(root, { recursive: true, withFileTypes: true });
    files.push(...entries.filter(e => e.isFile() && e.name.endsWith('.jsonl')).map(e => join(e.parentPath, e.name)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') scan.missingDirectories++;
    else scan.directoryErrors++;
  }
  scan.filesScanned = files.length;
  const groups = new Map<string, Signal[]>();
  for (const file of files.sort()) for (const signal of await readSignals(file, scan)) {
    const group = groups.get(signal.identity) ?? [];
    group.push(signal);
    groups.set(signal.identity, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => lexical(a.hookId, b.hookId) || lexical(a.startedAt, b.startedAt));
    const first = group[0]!;
    const starts = group.filter(s => s.phase === 'started');
    const ends = group.filter(s => s.phase === 'completed');
    // Count exact projected replays only; complementary started/completed are not duplicates.
    scan.duplicateSignals += group.length - new Set(group.map(s => JSON.stringify(s))).size;
    const conflict = new Set(group.map(s => s.hookId)).size > 1 || new Set(group.map(s => s.startedAt)).size > 1;
    if (conflict) scan.conflictingRuns++;
    if (!starts.length) scan.completionOnlyRuns++;
    if (!ends.length) scan.missingResults++;
    const terminals = new Set(ends.map(s => s.terminal));
    const finishes = new Set(ends.map(s => s.finishedAt));
    const ambiguous = conflict || terminals.size !== 1 || terminals.has('unknown') || finishes.has(null) || finishes.size !== 1;
    if (ends.length && ambiguous) scan.ambiguousResults++;
    const terminal = !ambiguous ? ends[0]?.terminal : null;
    const durations = new Set(ends.flatMap(s => s.durationMs === null ? [] : [s.durationMs]));
    if (durations.size > 1) scan.conflictingDurations++;
    records.push({ source: 'codex', identity: first.identity, hookId: first.hookId,
      event: first.event, configSource: first.configSource, handler: first.handler,
      startedAt: group.map(s => s.startedAt).sort()[0]!,
      finishedAt: !ambiguous ? ends[0]?.finishedAt ?? null : null,
      status: terminal === 'completed' ? 'succeeded' : terminal === 'failed' ? 'failed' : 'unknown',
      durationMs: !ambiguous && durations.size === 1 ? [...durations][0]! : null });
  }
  records.sort((a, b) => lexical(a.startedAt, b.startedAt) || lexical(a.identity, b.identity));
  return { records, scan, coverage: {
    input: 'offline-app-server-notifications', availability: files.length ? 'imports-found' : 'no-imports',
    nativePersistenceVerified: false, asyncCovered: false, timestampUnitRequiresDeclaration: true,
    notes: [
      'usage-hooks is an offline import convention, not a Codex native log directory. No collector is installed.',
      'Configuration, installation, trust and related sessions do not prove a Hook executed.',
      'Only declared-unit synchronous command/mcpTool notifications are supported; asynchronous runs and aggregate telemetry are not covered.',
      'No imported evidence means no observable runs, not proof that no Hooks ran. Synthetic fixtures do not certify real log compatibility.',
      '未导入执行证据时返回空结果；配置存在不能证明 Hook 运行。',
    ],
  } };
}
