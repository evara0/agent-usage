## ADDED Requirements

### Requirement: Evidence-based offline Hook collection
系统 SHALL 只从显式声明格式和时间单位的离线 Hook 通知导入最小执行记录，且 MUST 区分配置与执行，不执行 Hook 或部署采集机制。

#### Scenario: Configuration without execution evidence
- **WHEN** 目录只有 Hook 配置、会话或普通工具输出
- **THEN** 调用数为零并说明缺少离线通知及非完整覆盖

#### Scenario: Explicit run summaries
- **WHEN** 导入受支持的同步 command/mcpTool Hook started/completed 通知
- **THEN** 使用明确 thread/run 身份关联，配置路径哈希，忽略正文和秘密字段

#### Scenario: Undeclared timestamp units
- **WHEN** 输入没有有效的首行格式及时间单位声明
- **THEN** 文件不产生记录并增加不支持文件计数，不猜测秒或毫秒

### Requirement: Conservative correlation and aggregation
系统 SHALL 对重放与乱序按联合身份去重，并分别表达明确成功、明确失败、unknown 及可靠耗时样本；MUST 不从传输完成、批准、阻断、取消或非空文本推断执行结果。

#### Scenario: Missing or conflicting results
- **WHEN** 结束缺失、终态冲突、时间无效或身份冲突
- **THEN** 结果保持 unknown 并提供对应质量计数

#### Scenario: Missing and zero duration
- **WHEN** 耗时缺失或明确为零
- **THEN** 缺失不增加样本数，零增加样本数且总耗时为零，不用时间差补全

#### Scenario: Window and stable grouping
- **WHEN** 指定 days
- **THEN** 先关联去重再按开始时间过滤，按 Hook/事件/来源/handler 稳定分组且不改变输入

### Requirement: Hook CLI and coverage reporting
系统 SHALL 提供 --hooks 的表格及完整 JSON、表格 limit、days、codex-dir 和直接 UTF-8 output；MUST 保持 Skill/MCP 行为及 source=codex 语义。

#### Scenario: Conflicting options
- **WHEN** hooks 与 mcp、strict 或 markdown 组合
- **THEN** 在扫描前拒绝参数，不静默忽略

#### Scenario: Limited table and complete export
- **WHEN** limit 小于分组数或使用 json/output
- **THEN** limit 仅截断表格行，JSON 完整且文件输出为无 BOM UTF-8

#### Scenario: Incomplete evidence coverage
- **WHEN** 没有可靠数据、损坏数据或未支持来源
- **THEN** 返回可解释覆盖信息与整次扫描质量，不编造 runId、执行或成功率，也不把遥测直方图伪装成调用
