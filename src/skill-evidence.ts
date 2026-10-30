import { parseMcpTimestamp } from './mcp-aggregate.js';
import type { SkillCounts, SkillEvidence, SkillEvidencePackage, SkillComparisonReport,
  SkillComparisonRow, SkillGroup, SkillMode, UnresolvedSkillEvidence } from './skill-evidence-types.js';

export const SKILL_KEYS = ['sourceInstanceId', 'sessionId', 'turnId', 'skillKey'];
export const MAX_SKILL_EVIDENCE = 10_000;
export function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function fail(at: string): never { throw new TypeError('Invalid skill evidence: ' + at); }
export function id(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512 &&
    value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
}
export function timestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const offset = /([+-])(\d\d):(\d\d)$/.exec(value);
  if (offset && (Number(offset[2]) > 23 || Number(offset[3]) > 59)) return null;
  return parseMcpTimestamp(value);
}
function fields(value: Record<string, unknown>, allowed: string[], at: string) {
  if (Object.keys(value).some(k => !allowed.includes(k))) fail(at + '.unknownField');
}
const methods = ['logs', 'hooks'];
const types = ['skill_requested', 'skill_injected', 'skill_read_attempt'];
function evidence(value: unknown, at: string): SkillEvidence {
  if (!object(value)) fail(at);
  fields(value, ['method','sourceRecordId','sessionId','turnId','skillKey','type','occurredAt','sourceRef'], at);
  if (!methods.includes(value.method as string) || !types.includes(value.type as string)) fail(at + '.type/method');
  for (const key of ['sourceRecordId','sessionId','turnId','skillKey']) {
    if (value[key] !== null && !id(value[key])) fail(at + '.' + key);
  }
  if (value.occurredAt !== null && !timestamp(value.occurredAt)) fail(at + '.occurredAt');
  if (value.sourceRef !== undefined) {
    if (!object(value.sourceRef) || !id(value.sourceRef.fileId) ||
      !Number.isSafeInteger(value.sourceRef.line) || Number(value.sourceRef.line) < 1) fail(at + '.sourceRef');
    fields(value.sourceRef, ['fileId','line'], at + '.sourceRef');
  }
  return { method: value.method as SkillEvidence['method'], sourceRecordId: value.sourceRecordId as string | null,
    sessionId: value.sessionId as string | null, turnId: value.turnId as string | null,
    skillKey: value.skillKey as string | null, type: value.type as SkillEvidence['type'],
    occurredAt: value.occurredAt === null ? null : timestamp(value.occurredAt)!,
    ...(value.sourceRef ? { sourceRef: value.sourceRef as SkillEvidence['sourceRef'] } : {}) };
}
function unresolved(value: unknown, at: string): UnresolvedSkillEvidence {
  if (!object(value)) fail(at);
  fields(value, ['evidence','reason','affectedSkillKeys','affectedMethods'], at);
  if (!id(value.reason) || !Array.isArray(value.evidence) || !value.evidence.length ||
    value.evidence.length > MAX_SKILL_EVIDENCE) fail(at);
  const candidates = value.evidence.map((e, i) => evidence(e, at + '.evidence[' + i + ']'));
  if (value.affectedSkillKeys !== null && (!Array.isArray(value.affectedSkillKeys) ||
    !value.affectedSkillKeys.length || !value.affectedSkillKeys.every(id))) fail(at + '.affectedSkillKeys');
  if (!Array.isArray(value.affectedMethods) || !value.affectedMethods.length ||
    value.affectedMethods.some(m => !methods.includes(m))) fail(at + '.affectedMethods');
  // The declared impact must not hide any candidate's scope.
  if (candidates.some(e => !(value.affectedMethods as string[]).includes(e.method))) fail(at + '.affectedMethods');
  if (value.affectedSkillKeys !== null && candidates.some(e => e.skillKey === null ||
    !(value.affectedSkillKeys as string[]).includes(e.skillKey))) fail(at + '.affectedSkillKeys');
  return { evidence: candidates, reason: value.reason, affectedSkillKeys: value.affectedSkillKeys as string[] | null,
    affectedMethods: value.affectedMethods as SkillEvidence['method'][] };
}
function validCount(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}
function validateCounts(value: unknown, extra: string[], at: string) {
  if (!object(value)) fail(at);
  fields(value, ['logsExplicit','logsInferred','hooks','uniqueTotal',...extra], at);
  for (const k of ['logsExplicit','logsInferred','hooks','uniqueTotal']) if (!validCount(value[k])) fail(at + '.' + k);
}
function validatePackage(value: unknown): SkillEvidencePackage {
  if (!object(value)) fail('package');
  fields(value, ['schemaVersion','kind','mode','countUnit','sourceInstanceId','timeZone','period','generatedAt',
    'producer','deduplication','evidence','skills','totals','comparison'], 'package');
  if (value.schemaVersion !== 1 || value.kind !== 'skill-usage-comparison' || value.countUnit !== 'skill-turn' ||
    !['logs','hooks','combined'].includes(value.mode as string) || !id(value.sourceInstanceId)) fail('header');
  if (typeof value.timeZone !== 'string') fail('timeZone');
  try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }).format(); } catch { fail('timeZone'); }
  if (!timestamp(value.generatedAt)) fail('generatedAt');
  if (!object(value.period)) fail('period');
  fields(value.period, ['start','end'], 'period');
  const { start, end } = value.period;
  if ((start === null) !== (end === null) ||
    (start !== null && (!timestamp(start) || !timestamp(end) || Date.parse(end as string) <= Date.parse(start as string)))) fail('period');
  if (value.producer !== undefined) {
    const p = value.producer;
    if (!object(p) || !id(p.name) || !id(p.version) || !['automated','agent-assisted','manual'].includes(p.mode as string)) fail('producer');
    fields(p, ['name','version','mode'], 'producer');
  }
  const d = value.deduplication;
  if (!object(d) || d.ruleVersion !== 'skill-turn-v1' || JSON.stringify(d.keyFields) !== JSON.stringify(SKILL_KEYS) ||
    !Array.isArray(d.unresolvedEvidence) || d.unresolvedEvidence.length > MAX_SKILL_EVIDENCE) fail('deduplication');
  fields(d, ['ruleVersion','keyFields','unresolvedEvidence'], 'deduplication');
  if (!Array.isArray(value.evidence) || value.evidence.length > MAX_SKILL_EVIDENCE) fail('evidence');
  const es = value.evidence.map((e, i) => evidence(e, 'evidence[' + i + ']'));
  const us = d.unresolvedEvidence.map((u, i) => unresolved(u, 'unresolvedEvidence[' + i + ']'));
  if (es.length + us.reduce((n,u) => n + u.evidence.length,0) > MAX_SKILL_EVIDENCE) fail('evidence.limit');
  if ((value.skills === undefined) !== (value.totals === undefined)) fail('skills/totals.pair');
  if (value.skills !== undefined) {
    if (!Array.isArray(value.skills) || value.skills.length > MAX_SKILL_EVIDENCE) fail('skills');
    const seen = new Set();
    for (const [i,row] of value.skills.entries()) {
      validateCounts(row, ['skillKey','skill','lastRecorded'], 'skills[' + i + ']');
      if (!object(row) || !id(row.skillKey) || !id(row.skill) || seen.has(row.skillKey) ||
        (row.lastRecorded !== null && !timestamp(row.lastRecorded))) fail('skills[' + i + ']');
      seen.add(row.skillKey);
    }
    validateCounts(value.totals, ['skills'], 'totals');
    if (!object(value.totals) || !validCount(value.totals.skills)) fail('totals.skills');
  }
  return { ...value, evidence: es, deduplication: { ...d, unresolvedEvidence: us } } as unknown as SkillEvidencePackage;
}
export function makeSkillPackage(sourceInstanceId: string, evidence: SkillEvidence[] = [],
  unresolvedEvidence: UnresolvedSkillEvidence[] = []): SkillEvidencePackage {
  return { schemaVersion: 1, kind: 'skill-usage-comparison', mode: 'combined', countUnit: 'skill-turn',
    sourceInstanceId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    period: { start: null, end: null }, generatedAt: new Date().toISOString(),
    deduplication: { ruleVersion: 'skill-turn-v1', keyFields: [...SKILL_KEYS], unresolvedEvidence }, evidence };
}
export function pending(evidence: SkillEvidence[], reason: string): UnresolvedSkillEvidence {
  return { evidence, reason, affectedSkillKeys: evidence.some(e => e.skillKey === null) ? null :
    [...new Set(evidence.map(e => e.skillKey!))].sort(),
    affectedMethods: [...new Set(evidence.map(e => e.method))].sort() };
}
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const projection = (e: SkillEvidence) => JSON.stringify([e.method,e.sourceRecordId,e.sessionId,e.turnId,e.skillKey,e.type,e.occurredAt]);
export function skillEvidenceInView(e:SkillEvidence,p:Pick<SkillEvidencePackage,'mode'|'period'>):boolean{
  return (p.mode==='combined'||e.method===p.mode)&&(e.occurredAt===null||p.period.start===null||
    (Date.parse(e.occurredAt)>=Date.parse(p.period.start)&&Date.parse(e.occurredAt)<Date.parse(p.period.end!)));
}
export function createSkillReport(input: SkillEvidencePackage, options: {
  mode?: SkillMode; period?: SkillEvidencePackage['period']; generatedAt?: string; timeZone?: string
} = {}): SkillComparisonReport {
  const p = validatePackage({ ...input, ...options, skills: undefined, totals: undefined });
  const byIdentity = new Map<string, SkillEvidence[]>();
  const unresolvedItems = [...p.deduplication.unresolvedEvidence];
  // Include unresolved candidates when detecting same-ID conflicts; a second import must not resurrect them.
  for (const e of [...p.evidence, ...unresolvedItems.flatMap(u => u.evidence)]) {
    if (!e.sessionId || !e.sourceRecordId) continue;
    const key = JSON.stringify([p.sourceInstanceId,e.method,e.sessionId,e.sourceRecordId]);
    const candidates = byIdentity.get(key) ?? [];
    if (!candidates.some(c => projection(c) === projection(e))) candidates.push(e);
    byIdentity.set(key,candidates);
  }
  const accepted: SkillEvidence[] = [];
  const visited = new Set<string>();
  for (const e of p.evidence) {
    const key = JSON.stringify([p.sourceInstanceId,e.method,e.sessionId,e.sourceRecordId]);
    if (e.sessionId && e.sourceRecordId && visited.has(key)) continue;
    visited.add(key);
    const candidates = byIdentity.get(key) ?? [e];
    if (candidates.length > 1) { unresolvedItems.push(pending(candidates,'conflicting-source-record')); continue; }
    if (!e.sourceRecordId || !e.sessionId || !e.turnId || !e.skillKey || !e.occurredAt) {
      unresolvedItems.push(pending([e],'missing-identity-or-time')); continue;
    }
    if (unresolvedItems.some(u => u.evidence.some(c => projection(c) === projection(e)))) continue;
    accepted.push(e);
  }
  accepted.sort((a,b) => lexical(projection(a),projection(b)));
  const unresolvedUnique = [...new Map(unresolvedItems.map(u => {
    const normal = { ...u, evidence: [...u.evidence].sort((a,b)=>lexical(projection(a),projection(b))),
      affectedMethods: [...new Set(u.affectedMethods)].sort(), affectedSkillKeys: u.affectedSkillKeys === null ? null : [...new Set(u.affectedSkillKeys)].sort() };
    return [JSON.stringify(normal),normal] as const;
  })).values()].sort((a,b)=>lexical(JSON.stringify(a),JSON.stringify(b)));
  const selected = (e: SkillEvidence) => skillEvidenceInView(e,p);
  const relevant = accepted.filter(selected);
  const relevantPending = unresolvedUnique.filter(u => u.evidence.some(selected));
  const rows = new Map<string, SkillComparisonRow>();
  const counts = (): SkillCounts => ({ logsExplicit: p.mode === 'hooks' ? null : 0,
    logsInferred: p.mode === 'hooks' ? null : 0, hooks: p.mode === 'logs' ? null : 0, uniqueTotal: 0 });
  const row = (key: string) => {
    if (!rows.has(key)) rows.set(key,{ skillKey:key,skill:key.split(':').at(-1)!,...counts(),lastRecorded:null });
    return rows.get(key)!;
  };
  for (const e of [...relevant,...relevantPending.flatMap(u => u.evidence.filter(selected))]) {
    if (!e.skillKey) continue;
    const r=row(e.skillKey);
    if (e.occurredAt && (!r.lastRecorded || Date.parse(e.occurredAt)>Date.parse(r.lastRecorded))) r.lastRecorded=e.occurredAt;
  }
  const groups = new Map<string,{ identity:SkillGroup; evidence:SkillEvidence[] }>();
  for (const e of relevant) {
    const identity={ sourceInstanceId:p.sourceInstanceId,sessionId:e.sessionId!,turnId:e.turnId!,skillKey:e.skillKey! };
    const key=JSON.stringify(SKILL_KEYS.map(k=>identity[k as keyof SkillGroup]));
    const group=groups.get(key)??{ identity,evidence:[] };group.evidence.push(e);groups.set(key,group);
  }
  const comparison: SkillComparisonReport['comparison']={ matched:[],logsOnly:[],hooksOnly:[] };
  for (const group of groups.values()) {
    const r=row(group.identity.skillKey);
    const ls=group.evidence.filter(e=>e.method==='logs');
    const hs=group.evidence.some(e=>e.method==='hooks');
    if(ls.some(e=>e.type!=='skill_read_attempt')) r.logsExplicit!++;
    else if(ls.length) r.logsInferred!++;
    if(hs) r.hooks!++;
    r.uniqueTotal!++;
    comparison[ls.length && hs ? 'matched' : ls.length ? 'logsOnly' : 'hooksOnly'].push(group.identity);
  }
  let unknownGlobal=false;
  const globalImpact=new Set<string>();
  for (const u of relevantPending) {
    const ms=u.affectedMethods.filter(m=>p.mode==='combined'||m===p.mode);
    if(!ms.length) continue;
    const affected=u.affectedSkillKeys===null ? [...rows.keys()] : u.affectedSkillKeys;
    if(u.affectedSkillKeys===null) unknownGlobal=true;
    const columns=['uniqueTotal',...(ms.includes('logs')?['logsExplicit','logsInferred']:[]),...(ms.includes('hooks')?['hooks']:[])];
    for(const key of affected) for(const column of columns) row(key)[column as keyof SkillCounts]=null;
    for(const column of columns) globalImpact.add(column);
  }
  const skills=[...rows.values()].sort((a,b)=>(a.uniqueTotal===null?1:0)-(b.uniqueTotal===null?1:0) ||
    (b.uniqueTotal??0)-(a.uniqueTotal??0)||lexical(a.skillKey,b.skillKey));
  const totals:SkillComparisonReport['totals']={...counts(),skills:unknownGlobal?null:skills.length};
  for(const col of ['logsExplicit','logsInferred','hooks','uniqueTotal'] as const) {
    if(globalImpact.has(col)||skills.some(s=>s[col]===null)) totals[col]=null;
    else if(totals[col]!==null) {
      totals[col]=skills.reduce((n,s)=>n+s[col]!,0);
      if(!Number.isSafeInteger(totals[col])) fail('totals.overflow');
    }
  }
  for(const list of Object.values(comparison))list.sort((a,b)=>lexical(JSON.stringify(a),JSON.stringify(b)));
  return {...p,evidence:accepted,deduplication:{...p.deduplication,unresolvedEvidence:unresolvedUnique},skills,totals,comparison};
}
function summaryRows(rows: NonNullable<SkillEvidencePackage['skills']>) {
  return rows.map(r=>({skillKey:r.skillKey,skill:r.skill,logsExplicit:r.logsExplicit,logsInferred:r.logsInferred,hooks:r.hooks,uniqueTotal:r.uniqueTotal,lastRecorded:r.lastRecorded===null?null:timestamp(r.lastRecorded)}))
    .sort((a,b)=>lexical(a.skillKey,b.skillKey));
}
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
}
export function parseSkillPackage(value: unknown): SkillEvidencePackage {
  const p=validatePackage(value);
  if(p.skills && p.totals) {
    const rebuilt=createSkillReport(p);
    if(JSON.stringify(summaryRows(p.skills))!==JSON.stringify(summaryRows(rebuilt.skills)) ||
      JSON.stringify(['logsExplicit','logsInferred','hooks','uniqueTotal','skills'].map(k=>p.totals![k as keyof typeof p.totals]))!==
      JSON.stringify(['logsExplicit','logsInferred','hooks','uniqueTotal','skills'].map(k=>rebuilt.totals[k as keyof typeof rebuilt.totals]))) fail('summary-mismatch');
    if(object(value) && value.comparison!==undefined &&
      stable(value.comparison)!==stable(rebuilt.comparison)) fail('comparison-mismatch');
  }
  return p;
}
export function mergeSkillPackages(packages: SkillEvidencePackage[]): SkillEvidencePackage {
  if(!packages.length) fail('packages.empty');
  const first=packages[0]!;
  if(packages.some(p=>p.sourceInstanceId!==first.sourceInstanceId)) fail('sourceInstanceId.mismatch');
  return {...first,mode:'combined',period:{start:null,end:null},skills:undefined,totals:undefined,
    evidence:packages.flatMap(p=>p.evidence),deduplication:{...first.deduplication,
      unresolvedEvidence:packages.flatMap(p=>p.deduplication.unresolvedEvidence)}};
}
