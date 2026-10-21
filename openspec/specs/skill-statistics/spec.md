# skill-statistics Specification

## Purpose
只读统计本地 Codex Skill 使用证据，保留明确与推断口径、去重规则、时间窗口、终端表格和完整 JSON，并通过合成数据验证参数及聚合行为。

## Requirements

### Requirement: Codex local collection
The CLI SHALL read sessions, archived_sessions and history.jsonl from the selected Codex home (default ~/.codex) without executing log code, and preserve static Windows/POSIX/.system function/custom reads.
#### Scenario: Static inference
- **WHEN** supported static reading commands reference SKILL.md
- **THEN** inferred events are emitted; searches, echo, comments and dynamic expressions are excluded
#### Scenario: Missing and malformed input
- **WHEN** files are missing or rows are malformed
- **THEN** collection continues with valid available data

### Requirement: Evidence aggregation
The module SHALL preserve manual $skill, injection, 120-second manual merging, 300-second echo suppression, injection replay deduplication and normalization. Explicit events SHALL deduplicate by session/skill/second; inferred events SHALL count at most once per session/skill and be suppressed by retained explicit events.
#### Scenario: Strict window
- **WHEN** --strict and --days N are used
- **THEN** inferred events and events older than N times 24 hours are excluded before aggregation

### Requirement: CLI contract
The CLI SHALL offer --days/-d, --limit/-l, --strict, --json, --codex-dir, help and version, validate numeric values and reject unknown or removed arguments and commands. JSON SHALL be directly parseable and preserve source codex, windowDays, filesScanned, elapsedMs, totals and all skills including daily, projects and aliases.
#### Scenario: Evidence table
- **WHEN** the default command runs
- **THEN** Skill, Total, Explicit, Inferred and Last recorded are displayed, with Explicit equal to total minus inferredAuto
#### Scenario: Display limit
- **WHEN** --limit restricts rows
- **THEN** totals and JSON skill lists remain complete
#### Scenario: Removed scope
- **WHEN** daily, Claude, source or subagent arguments are used
- **THEN** they are rejected and help documents only Codex statistics

### Requirement: Local management
The project SHALL use Git and OpenSpec and ignore handoff, local logs, dependencies and build outputs.
#### Scenario: Delivery
- **WHEN** implementation completes
- **THEN** source, usage and maintenance are documented and verified changes are preserved in local Git commits; pushing and OpenSpec archival occur only with explicit user authorization
