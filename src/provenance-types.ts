/** Current references only: no event-time provenance or attribution counts. */
export type ProvenanceEvidence = 'file_declared' | 'user_declared';
export interface ProvenanceClaim<T> {
  status: 'unknown' | 'declared' | 'conflict';
  values: { value: T; evidence: ProvenanceEvidence; scope: 'skill' | 'package' | 'user' }[];
}
export type DistributionDeclaration = 'openai_official' | 'third_party' | 'self_published';
export type AcquisitionDeclaration = 'bundled' | 'plugin_catalog' | 'git_install' | 'local_copy' | 'local_create';
export type LocalDeclaration = 'declared_original' | 'imported' | 'adapted' | 'forked';
export interface ProvenanceFields {
  publisher: ProvenanceClaim<string>;
  originalAuthors: ProvenanceClaim<string[]>;
  distribution: ProvenanceClaim<DistributionDeclaration>;
  acquisition: ProvenanceClaim<AcquisitionDeclaration>;
  license: ProvenanceClaim<string>;
  localState: ProvenanceClaim<LocalDeclaration>;
}
export interface SkillInstallation extends ProvenanceFields {
  /** Scoped to this invocation's explicit roots; not a globally stable identity. */
  id: string;
  kind: 'standalone' | 'plugin_package' | 'user_registered';
  names: string[];
  version: string | null;
}
export interface ProvenanceAssociation {
  skill: string;
  status: 'unknown' | 'candidate' | 'ambiguous';
  candidateIds: string[];
  unresolvedAliases: string[];
}
export interface ProvenanceDiagnostics {
  missingFiles: number;
  unreadableFiles: number;
  invalidMetadata: number;
  unsupportedMetadata: number;
  skippedLinks: number;
  truncatedDirectories: number;
  unmatchedMappings: number;
}
export interface SkillProvenanceReport {
  schemaVersion: 1;
  observedAt: string;
  temporalScope: 'current_reference_only';
  inventory: SkillInstallation[];
  associations: ProvenanceAssociation[];
  diagnostics: ProvenanceDiagnostics;
}
export interface ProvenanceMappingEntry {
  installationId: string;
  aliases?: string[];
  publisher?: string;
  originalAuthors?: string[];
  distribution?: DistributionDeclaration;
  acquisition?: AcquisitionDeclaration;
  license?: string;
  localState?: LocalDeclaration;
}
export interface ProvenanceMapping { version: 1; entries: ProvenanceMappingEntry[] }
