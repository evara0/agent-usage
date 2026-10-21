import { lstat, open, opendir } from 'node:fs/promises';
import { join, parse, resolve } from 'node:path';
import type { SkillStats } from './contracts.js';
import type {
  ProvenanceClaim, ProvenanceEvidence, ProvenanceFields, SkillInstallation,
  SkillProvenanceReport, ProvenanceDiagnostics, ProvenanceMapping, ProvenanceMappingEntry,
} from './provenance-types.js';

const MAX_BYTES = 65_536;
const MAX_ENTRIES = 256;
const TOKEN = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{0,79}$/u;
const ALIAS = /^[\p{L}\p{N}_][\p{L}\p{N}_.:-]{0,199}$/u;
const DISPLAY = /^[^\x00-\x1f\x7f-\x9f\u2028\u2029@:/\\]{1,120}$/u;
const fields = ['publisher', 'originalAuthors', 'distribution', 'acquisition', 'license', 'localState'] as const;
const enumValues = {
  distribution: ['openai_official', 'third_party', 'self_published'],
  acquisition: ['bundled', 'plugin_catalog', 'git_install', 'local_copy', 'local_create'],
  localState: ['declared_original', 'imported', 'adapted', 'forked'],
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function display(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && DISPLAY.test(value);
}
function strings(value: unknown, pattern: RegExp): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 32 &&
    value.every(item => typeof item === 'string' && pattern.test(item)) && new Set(value).size === value.length;
}
function mappingId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 300 && (
    /^standalone:(?:\.system\/)?[\p{L}\p{N}][\p{L}\p{N}_.-]{0,79}$/u.test(value) ||
    /^plugin:[\p{L}\p{N}][\p{L}\p{N}_.-]{0,79}@[\p{L}\p{N}_.-]{1,80}:skills\/[\p{L}\p{N}][\p{L}\p{N}_.-]{0,79}$/u.test(value) ||
    /^registered:[\p{L}\p{N}][\p{L}\p{N}_.-]{0,79}$/u.test(value)
  );
}

/** No coercion, unknown properties, arbitrary selectors, or unbounded entries. */
export function parseProvenanceMapping(value: unknown): ProvenanceMapping {
  const invalid = () => new Error('Invalid provenance mapping (expected bounded version 1 declarations; see docs/skill-provenance.md)');
  if (!record(value) || Object.keys(value).some(key => !['version', 'entries'].includes(key)) ||
      value.version !== 1 || !Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES) throw invalid();
  const ids = new Set<string>();
  for (const entry of value.entries) {
    if (!record(entry) || Object.keys(entry).some(key => !['installationId', 'aliases', ...fields].includes(key)) ||
        !mappingId(entry.installationId) || ids.has(entry.installationId)) throw invalid();
    ids.add(entry.installationId);
    if (entry.aliases !== undefined && !strings(entry.aliases, ALIAS)) throw invalid();
    if (entry.installationId.startsWith('registered:') && entry.aliases === undefined) throw invalid();
    for (const field of ['publisher', 'license'] as const) {
      if (entry[field] !== undefined && !display(entry[field])) throw invalid();
    }
    if (entry.originalAuthors !== undefined && (!Array.isArray(entry.originalAuthors) ||
        entry.originalAuthors.length === 0 || entry.originalAuthors.length > 32 ||
        !entry.originalAuthors.every(display) || new Set(entry.originalAuthors).size !== entry.originalAuthors.length)) throw invalid();
    for (const field of ['distribution', 'acquisition', 'localState'] as const) {
      if (entry[field] !== undefined && (typeof entry[field] !== 'string' ||
          !enumValues[field].includes(entry[field]))) throw invalid();
    }
  }
  // Copy validated data so callers cannot mutate the original into an unsafe map.
  return structuredClone(value) as unknown as ProvenanceMapping;
}

const diagnostics = (): ProvenanceDiagnostics => ({
  missingFiles: 0, unreadableFiles: 0, invalidMetadata: 0, unsupportedMetadata: 0,
  skippedLinks: 0, truncatedDirectories: 0, unmatchedMappings: 0,
});

/** Check every path component: even explicitly supplied symlink roots are refused. */
async function noLinks(path: string, diag: ProvenanceDiagnostics): Promise<boolean> {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(/[/\\]/).filter(Boolean)) {
    current = join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) { diag.skippedLinks++; return false; }
  }
  return true;
}

function readError(error: unknown, diag: ProvenanceDiagnostics): void {
  if (record(error) && error.code === 'ENOENT') diag.missingFiles++;
  else diag.unreadableFiles++;
}

async function textFile(path: string, diag: ProvenanceDiagnostics): Promise<string | null> {
  try {
    if (!await noLinks(path, diag)) return null;
    if (!(await lstat(path)).isFile()) { diag.unsupportedMetadata++; return null; }
    const handle = await open(path, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_BYTES) { diag.unsupportedMetadata++; return null; }
      const buffer = Buffer.alloc(MAX_BYTES + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > MAX_BYTES) { diag.unsupportedMetadata++; return null; }
      try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead)); }
      catch { diag.invalidMetadata++; return null; }
    } finally { await handle.close(); }
  } catch (error) { readError(error, diag); return null; }
}

export async function loadProvenanceMapping(path: string): Promise<ProvenanceMapping> {
  const diag = diagnostics();
  const text = await textFile(path, diag);
  if (text === null) throw new Error('Unable to read provenance mapping (regular UTF-8 file, no links, at most 64 KiB required)');
  try { return parseProvenanceMapping(JSON.parse(text)); }
  catch { throw new Error('Invalid provenance mapping (expected bounded version 1 declarations; see docs/skill-provenance.md)'); }
}

async function directories(path: string, diag: ProvenanceDiagnostics): Promise<string[]> {
  const names: string[] = [];
  try {
    if (!await noLinks(path, diag)) return names;
    const dir = await opendir(path);
    let seen = 0;
    try {
      for (;;) {
        const item = await dir.read();
        if (!item) break;
        if (++seen > MAX_ENTRIES) { diag.truncatedDirectories++; break; }
        if (item.isSymbolicLink()) { diag.skippedLinks++; continue; }
        if (item.isDirectory() && (TOKEN.test(item.name) || item.name === '.system')) names.push(item.name);
      }
    } finally { await dir.close(); }
  } catch (error) { readError(error, diag); }
  return names.sort();
}

function unknown<T>(): ProvenanceClaim<T> { return { status: 'unknown', values: [] }; }
function emptyFields(): ProvenanceFields {
  return { publisher: unknown(), originalAuthors: unknown(), distribution: unknown(),
    acquisition: unknown(), license: unknown(), localState: unknown() };
}
function add<T>(claim: ProvenanceClaim<T>, value: T, evidence: ProvenanceEvidence,
  scope: 'skill' | 'package' | 'user' = evidence === 'user_declared' ? 'user' : 'skill'): void {
  const key = JSON.stringify(value);
  if (!claim.values.some(item => item.evidence === evidence && item.scope === scope && JSON.stringify(item.value) === key)) {
    claim.values.push({ value, evidence, scope });
  }
  claim.status = new Set(claim.values.map(item => JSON.stringify(item.value))).size > 1 ? 'conflict' : 'declared';
}

/** Deliberately limited single-line scalar subset; unsupported YAML is never guessed. */
function scalar(raw: string): string | null {
  const value = raw.trim();
  if (value.startsWith('"')) {
    try { const parsed: unknown = JSON.parse(value); return typeof parsed === 'string' ? parsed : null; }
    catch { return null; }
  }
  if (value.startsWith("'")) {
    return /^'(?:[^']|'')*'$/.test(value) ? value.slice(1, -1).replaceAll("''", "'") : null;
  }
  // YAML typed scalars are not author/name/license strings. Quoted forms remain strings.
  if (/^(?:null$|~$|true$|false$|[-+]?(?:[0-9]|\.[0-9])|[-+]?\.(?:nan|inf)$)/i.test(value)) return null;
  return value && !/[#:[\]{}&*!|>'"`]/.test(value) ? value : null;
}

function skillMetadata(text: string, diag: ProvenanceDiagnostics): { name?: string; license?: string; author?: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) { diag.invalidMetadata++; return {}; }
  const selected = new Map<string, string | null>();
  let inMetadata = false;
  let metadataBlocks = 0;
  let unsupportedAuthorBlock = false;
  for (const line of match[1]!.split(/\r?\n/)) {
    if (/^\S/.test(line) && !line.startsWith('#')) {
      // Quoted/complex keys can alias a selected key; refuse the ambiguous header.
      if (!/^[A-Za-z][A-Za-z0-9_-]*[ \t]*:/.test(line)) { diag.unsupportedMetadata++; return {}; }
      if (/^metadata[ \t]*:/.test(line)) metadataBlocks++;
      inMetadata = /^metadata:[ \t]*$/.test(line);
    } else if (inMetadata && line.trim() && !line.trimStart().startsWith('#') &&
        !/^  [A-Za-z][A-Za-z0-9_-]*[ \t]*:/.test(line)) {
      unsupportedAuthorBlock = true;
    }
    const field = /^(name|license)[ \t]*:[ \t]*(.*)$/.exec(line);
    const author = inMetadata ? /^  author[ \t]*:[ \t]*(.*)$/.exec(line) : null;
    const key = field?.[1] ?? (author ? 'author' : null);
    if (key) {
      const raw = field?.[2] ?? author?.[1] ?? '';
      if (selected.has(key)) selected.set(key, null);
      else selected.set(key, scalar(raw));
    }
  }
  if (metadataBlocks > 1 || unsupportedAuthorBlock) selected.set('author', null);
  const result: { name?: string; license?: string; author?: string } = {};
  for (const [key, value] of selected) {
    if (value !== null && (key === 'name' ? TOKEN.test(value) : display(value))) {
      result[key as keyof typeof result] = value;
    } else diag.unsupportedMetadata++;
  }
  return result;
}

async function skill(path: string, id: string, kind: SkillInstallation['kind'], fallback: string,
  version: string | null, diag: ProvenanceDiagnostics, pluginName?: string): Promise<SkillInstallation | null> {
  const text = await textFile(join(path, 'SKILL.md'), diag);
  if (text === null) return null;
  const meta = skillMetadata(text, diag);
  const names = [...new Set([fallback, ...(meta.name ? [meta.name] : [])])];
  const item: SkillInstallation = { id, kind, names: pluginName ? names.map(name => `${pluginName}:${name}`) : names,
    version, ...emptyFields() };
  if (meta.author) add(item.originalAuthors, [meta.author], 'file_declared');
  if (meta.license) add(item.license, meta.license, 'file_declared');
  return item;
}

async function plugin(root: string, diag: ProvenanceDiagnostics): Promise<SkillInstallation[]> {
  let path = join(root, 'plugin.json');
  let portable = true;
  try {
    await lstat(path);
  } catch (error) {
    if (!record(error) || error.code !== 'ENOENT') { readError(error, diag); return []; }
    portable = false;
    path = join(root, '.codex-plugin', 'plugin.json');
  }
  const text = await textFile(path, diag);
  if (text === null) return [];
  let manifest: unknown;
  try { manifest = JSON.parse(text); } catch { diag.invalidMetadata++; return []; }
  if (!record(manifest) || typeof manifest.name !== 'string' || !TOKEN.test(manifest.name) ||
      (manifest.version !== undefined && (typeof manifest.version !== 'string' || !TOKEN.test(manifest.version)))) {
    diag.invalidMetadata++; return [];
  }
  if ((portable && manifest.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json') ||
      (!portable && manifest.skills !== './skills/' &&
       !(Array.isArray(manifest.skills) && manifest.skills.length === 1 && manifest.skills[0] === './skills/'))) {
    diag.unsupportedMetadata++; return [];
  }
  const version = typeof manifest.version === 'string' ? manifest.version : null;
  const items: SkillInstallation[] = [];
  for (const name of await directories(join(root, 'skills'), diag)) {
    if (!TOKEN.test(name)) continue;
    const item = await skill(join(root, 'skills', name),
      `plugin:${manifest.name}@${version ?? 'unknown'}:skills/${name}`, 'plugin_package', name, version, diag, manifest.name);
    if (!item) continue;
    if (record(manifest.author) && display(manifest.author.name)) add(item.publisher, manifest.author.name, 'file_declared', 'package');
    if (display(manifest.license)) add(item.license, manifest.license, 'file_declared', 'package');
    items.push(item);
  }
  return items;
}

function applyEntry(item: SkillInstallation, entry: ProvenanceMappingEntry): void {
  item.names = [...new Set([...item.names, ...(entry.aliases ?? [])])].sort();
  if (entry.publisher !== undefined) add(item.publisher, entry.publisher, 'user_declared');
  if (entry.originalAuthors !== undefined) add(item.originalAuthors, [...entry.originalAuthors].sort(), 'user_declared');
  if (entry.distribution !== undefined) add(item.distribution, entry.distribution, 'user_declared');
  if (entry.acquisition !== undefined) add(item.acquisition, entry.acquisition, 'user_declared');
  if (entry.license !== undefined) add(item.license, entry.license, 'user_declared');
  if (entry.localState !== undefined) add(item.localState, entry.localState, 'user_declared');
}

export interface ProvenanceOptions {
  skillRoot: string;
  pluginRoot?: string;
  mapping?: ProvenanceMapping;
  observedAt: string;
}

/** Reads explicit metadata only. Never reads sessions, credentials, assets, or remote URLs. */
export async function collectSkillProvenance(skills: readonly Pick<SkillStats, 'skill' | 'aliases'>[],
  options: ProvenanceOptions): Promise<SkillProvenanceReport> {
  // Validate even programmatic input before any filesystem reads.
  const mapping = options.mapping ? parseProvenanceMapping(options.mapping) : undefined;
  const diag = diagnostics();
  const inventory: SkillInstallation[] = [];
  for (const name of await directories(options.skillRoot, diag)) {
    if (name === '.system') {
      for (const child of await directories(join(options.skillRoot, name), diag)) {
        if (!TOKEN.test(child)) continue;
        if (inventory.length >= MAX_ENTRIES) { diag.truncatedDirectories++; break; }
        const item = await skill(join(options.skillRoot, name, child), `standalone:.system/${child}`,
          'standalone', child, null, diag);
        if (item) inventory.push(item);
      }
    } else {
      if (inventory.length >= MAX_ENTRIES) { diag.truncatedDirectories++; break; }
      const item = await skill(join(options.skillRoot, name), `standalone:${name}`, 'standalone', name, null, diag);
      if (item) inventory.push(item);
    }
  }
  if (options.pluginRoot) inventory.push(...await plugin(options.pluginRoot, diag));
  for (const entry of mapping?.entries ?? []) {
    let item = inventory.find(item => item.id === entry.installationId);
    if (!item && entry.installationId.startsWith('registered:')) {
      item = { id: entry.installationId, kind: 'user_registered', names: [], version: null, ...emptyFields() };
      inventory.push(item);
    }
    if (!item) { diag.unmatchedMappings++; continue; }
    applyEntry(item, entry);
  }
  inventory.sort((a, b) => a.id.localeCompare(b.id));
  const associations = skills.map(stats => {
    const aliases = stats.aliases.length ? stats.aliases : [stats.skill];
    const candidates = new Set<string>();
    const unresolvedAliases: string[] = [];
    for (const alias of aliases) {
      const matches = inventory.filter(item => item.names.includes(alias));
      if (!matches.length) unresolvedAliases.push(ALIAS.test(alias) ? alias : '[redacted]');
      for (const match of matches) candidates.add(match.id);
    }
    const candidateIds = [...candidates].sort();
    const status = candidateIds.length === 0 ? 'unknown' as const :
      candidateIds.length === 1 && !unresolvedAliases.length && !diag.truncatedDirectories ? 'candidate' as const : 'ambiguous' as const;
    return { skill: ALIAS.test(stats.skill) ? stats.skill : '[redacted]', status, candidateIds, unresolvedAliases };
  });
  return { schemaVersion: 1, observedAt: options.observedAt, temporalScope: 'current_reference_only', inventory, associations, diagnostics: diag };
}
