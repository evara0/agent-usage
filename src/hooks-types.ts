/** Hook-only contracts; independent of Skill/MCP public contracts. */
export const HOOK_EVENTS = ['preToolUse', 'permissionRequest', 'postToolUse', 'preCompact', 'postCompact',
  'sessionStart', 'sessionEnd', 'userPromptSubmit', 'subagentStart', 'subagentStop', 'stop', 'interrupt'] as const;
export const HOOK_SOURCES = ['system', 'user', 'project', 'mdm', 'sessionFlags', 'plugin', 'cloudRequirements',
  'cloudManagedConfig', 'legacyManagedConfigFile', 'legacyManagedConfigMdm', 'unknown'] as const;
export type HookEvent = typeof HOOK_EVENTS[number];
export type HookConfigSource = typeof HOOK_SOURCES[number];
export type HookStatus = 'succeeded' | 'failed' | 'unknown';
export interface HookRecord {
  source: 'codex';
  /** Opaque hashes: raw thread/run IDs and source paths never leave the adapter. */
  identity: string;
  hookId: string;
  event: HookEvent;
  configSource: HookConfigSource;
  handler: 'command' | 'mcpTool';
  startedAt: string;
  finishedAt: string | null;
  status: HookStatus;
  durationMs: number | null;
}
export interface HookCounts { invocations: number; succeeded: number; failed: number; unknown: number }
export interface HookStats extends HookCounts {
  hookId: string;
  event: HookEvent;
  configSource: HookConfigSource;
  handler: HookRecord['handler'];
  lastUsedAt: string;
  durationSamples: number;
  totalDurationMs: number;
}
export interface HookAggregateResult { hooks: HookStats[]; totals: HookCounts }
export interface HookScanQuality {
  filesScanned: number;
  filesRead: number;
  missingDirectories: number;
  directoryErrors: number;
  unreadableFiles: number;
  unsupportedFiles: number;
  malformedLines: number;
  invalidSignals: number;
  unsupportedSignals: number;
  startedSignals: number;
  completedSignals: number;
  duplicateSignals: number;
  conflictingRuns: number;
  ambiguousResults: number;
  missingResults: number;
  completionOnlyRuns: number;
  invalidDurations: number;
  conflictingDurations: number;
}
export interface HookCoverage {
  input: 'offline-app-server-notifications';
  availability: 'no-imports' | 'imports-found';
  nativePersistenceVerified: false;
  asyncCovered: false;
  timestampUnitRequiresDeclaration: true;
  notes: string[];
}
export interface HookScanResult { records: HookRecord[]; scan: HookScanQuality; coverage: HookCoverage }
