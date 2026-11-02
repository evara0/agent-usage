## MODIFIED Requirements
### Requirement: Codex local collection
CLI SHALL 使用本机映射与日志/Hook 证据适配器，日志读取所选 Codex home 下 sessions、archived_sessions、history.jsonl，不执行日志代码；配置缺失 MUST 提示 setup，不回退旧采集。
#### Scenario: 配置缺失
- **WHEN** 未初始化配置即查询默认 Skill
- **THEN** 返回 setup 指引且不输出旧结果
#### Scenario: Static inference
- **WHEN** 日志包含支持的静态 SKILL.md 读取
- **THEN** 使用新证据规则解析，身份不足保留未决候选

#### Scenario: Missing and malformed input
- **WHEN** 文件缺失或部分日志损坏
- **THEN** 继续处理可用证据并保留诊断

### Requirement: Evidence aggregation
Skill SHALL 按 sourceInstanceId/sessionId/turnId/skillKey 去重，使用现有 skill-turn-v1 规则；默认 resolved，支持 strict 未决策略，不再采用旧按秒和每会话聚合。
#### Scenario: Strict window
- **WHEN** 使用 --days 与 --skill-counts strict
- **THEN** 按新窗口筛选，未决影响的计数为 null，不自动排除推断

#### Scenario: 同轮双来源
- **WHEN** 同轮同技能在 logs 和 hooks 均有证据
- **THEN** Unique Total 仅计一次并保留分来源计数

### Requirement: CLI contract
默认 Skill CLI SHALL 使用 combined，可显式选择 logs/hooks/combined；表格、JSON、Markdown 共用 SkillComparisonReport。JSON MUST 使用 kind=skill-usage-comparison、schemaVersion=1 及 period、evidence、deduplication、skills、totals、comparison 等新字段。旧 SkillUsageReport、旧源码聚合接口 MUST 移除。--strict MUST 在读取前报错提示 --skill-counts strict 并说明语义变化；默认 Skill 允许 skill-evidence、skill-counts。数字和模式参数 MUST 在读取前验证。
#### Scenario: Evidence table
- **WHEN** 运行 --days 30 或 --days 30 --json
- **THEN** 以 combined 技能轮次统计输出，与显式 combined 相同
#### Scenario: Display limit
- **WHEN** 使用 limit
- **THEN** 仅截断终端行，JSON 与 Markdown 保留全部技能
#### Scenario: Removed scope
- **WHEN** 使用 --strict
- **THEN** 读取前失败并给出新策略指引，不自动映射旧语义
