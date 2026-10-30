export type SkillMethod = 'logs' | 'hooks';
export type SkillMode = SkillMethod | 'combined';
export type SkillCountPolicy = 'resolved' | 'strict';
export type SkillEvidenceType = 'skill_requested' | 'skill_injected' | 'skill_read_attempt';
export interface SkillEvidence {
  method: SkillMethod;
  sourceRecordId: string | null;
  sessionId: string | null;
  turnId: string | null;
  skillKey: string | null;
  type: SkillEvidenceType;
  occurredAt: string | null;
  sourceRef?: { fileId: string; line: number };
}
export interface UnresolvedSkillEvidence {
  evidence: SkillEvidence[];
  reason: string;
  affectedSkillKeys: string[] | null;
  affectedMethods: SkillMethod[];
}
export interface SkillCounts {
  logsExplicit: number | null;
  logsInferred: number | null;
  hooks: number | null;
  uniqueTotal: number | null;
}
export interface SkillComparisonRow extends SkillCounts {
  skillKey: string;
  skill: string;
  lastRecorded: string | null;
}
export interface SkillEvidencePackage {
  schemaVersion: 1;
  kind: 'skill-usage-comparison';
  mode: SkillMode;
  countUnit: 'skill-turn';
  countPolicy?: SkillCountPolicy;
  sourceInstanceId: string;
  timeZone: string;
  period: { start: string | null; end: string | null };
  generatedAt: string;
  producer?: { name: string; version: string; mode: 'automated' | 'agent-assisted' | 'manual' };
  deduplication: {
    ruleVersion: 'skill-turn-v1';
    keyFields: string[];
    unresolvedEvidence: UnresolvedSkillEvidence[];
  };
  evidence: SkillEvidence[];
  skills?: SkillComparisonRow[];
  totals?: SkillCounts & { skills: number | null };
}
export interface SkillGroup {
  sourceInstanceId: string;
  sessionId: string;
  turnId: string;
  skillKey: string;
}
export interface SkillComparisonReport extends SkillEvidencePackage {
  skills: SkillComparisonRow[];
  totals: SkillCounts & { skills: number | null };
  comparison: { matched: SkillGroup[]; logsOnly: SkillGroup[]; hooksOnly: SkillGroup[] };
}
