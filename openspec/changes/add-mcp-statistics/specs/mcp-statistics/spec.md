## Purpose

从已有本地 Codex 日志中识别有证据支持的 MCP 调用，向后续报告模块提供符合公共契约的调用与聚合数据，并明确区分缺失结果、未知服务端与缺失耗时，避免把日志覆盖不足解释为成功执行或零耗时。

## ADDED Requirements

### Requirement: 只读且可解释的本地采集
系统 SHALL 只读扫描指定 Codex 根目录下 sessions 和 archived_sessions 的 JSONL 文件，返回符合 McpCallRecord 的记录及不含会话正文的扫描计数；缺失目录和损坏行不得导致虚构调用。

#### Scenario: 空目录与损坏行
- **WHEN** 目录缺失、文件为空或部分行无法解析
- **THEN** 返回可用记录与对应扫描计数，空数据返回空数组，损坏行被跳过

#### Scenario: 缺失调用身份
- **WHEN** 日志缺少可靠 sessionId、callId 或有效调用时间
- **THEN** 不生成调用记录，并在扫描元信息中说明跳过情况

### Requirement: 联合身份与重放关联
系统 SHALL 以 source/sessionId/callId 关联调用和结果，同一身份的重复及重放只生成一次调用，支持结果先出现及跨当前和归档文件关联，不套用按秒或每会话 Skill 去重规则。

#### Scenario: 乱序与不同会话
- **WHEN** 结果先于调用出现，或两个会话使用相同 callId
- **THEN** 分别按完整身份关联，同一秒的不同 callId 仍分别计数

#### Scenario: 孤立或冲突证据
- **WHEN** 结果没有调用，或同一身份的调用/结果证据相互冲突
- **THEN** 孤立结果不生成调用，冲突调用的结果保留 unknown，扫描计数暴露冲突

### Requirement: 保守结果和耗时
系统 SHALL 保留工具名，只在明确服务端元信息存在时设置 server，否则为 null；只在关联到明确结果且结果时间有效、不早于开始时间时设置 succeeded 或 failed，其他情况均为 unknown 且 finishedAt/durationMs 为 null。

#### Scenario: 明确结果与缺失耗时
- **WHEN** 关联结果具有明确 isError 布尔值但没有可靠耗时
- **THEN** 分别按布尔值设置 failed 或 succeeded，finishedAt 为结果时间，durationMs 为 null

#### Scenario: 不确定结果
- **WHEN** 只有文本输出、没有显式结果标志、取消、阻断、超时或传输错误
- **THEN** 保留 unknown，不从文本非空或完成通知推断成功或失败

#### Scenario: 观测零耗时
- **WHEN** 明确结果带有可靠的非负有限耗时，包括零
- **THEN** 保留该耗时；无效、负值、非有限数或相互冲突的耗时使用 null

### Requirement: MCP 聚合不变量
系统 SHALL 输出 McpAggregateResult，按 server/tool 聚合，使用最新调用开始时间为 lastUsedAt，计数满足 invocations = succeeded + failed + unknown，仅对可靠耗时单独计样本。

#### Scenario: 聚合与窗口
- **WHEN** 提供调用记录和可选的正有限 days 参数
- **THEN** 按调用开始时间筛选最近 N×24 小时，边界包含在内，同一联合身份只计一次，按调用数降序及稳定名称顺序输出

#### Scenario: 无耗时与空输入
- **WHEN** 调用没有可靠耗时或输入为空
- **THEN** 无耗时分组 durationSamples 与 totalDurationMs 为 0，空输入的 tools 为空且所有 totals 为 0

#### Scenario: 非法聚合输入
- **WHEN** 输入记录违反公共契约或 days 不是正有限数
- **THEN** 明确抛出参数错误，不输出貌似有效的统计结果
