## ADDED Requirements

### Requirement: 公共报告契约
系统 SHALL 提供供报告模块消费的 SkillUsageReport 与无采集副作用的组装函数，保留既有 Skill 聚合类型导入路径和原有统计语义。

#### Scenario: 兼容的完整 JSON
- **WHEN** 用户运行既有 --json 命令
- **THEN** 原字段及嵌套数据保持原类型和口径，并增加 schemaVersion: 1、strict 和 timeZone；表格 limit 不截断报告

#### Scenario: 无副作用的报告组装
- **WHEN** 调用方提供聚合结果、生成时间、统计窗口、strict 状态、时区和扫描元信息
- **THEN** 组装函数不采集数据、不重新聚合、不修改输入，也不自行读取时钟或时区

### Requirement: MCP 调用身份与证据
系统 SHALL 独立定义 MCP 调用类型，以 source/sessionId/callId 关联一次调用，保留 tool、可空 server 和调用时间；不得把 Skill 使用证据当成 MCP 成功结果。

#### Scenario: 结果缺失
- **WHEN** 调用存在但结果尚未匹配或不足以判断
- **THEN** 记录 status 为 unknown，finishedAt 和 durationMs 为 null

#### Scenario: 明确结果
- **WHEN** 调用具有明确成功或失败结果
- **THEN** 记录区分 succeeded 与 failed，保留结果时间，缺少可靠耗时使用 null 而非 0

### Requirement: MCP 聚合边界
系统 SHALL 声明按 server/tool 聚合的 MCP 结果类型，并区分 succeeded、failed、unknown 及耗时样本数；不实施 MCP 采集和聚合算法。

#### Scenario: 分母与耗时
- **WHEN** 后续模块使用公共聚合类型
- **THEN** invocations 等于三类结果之和，未知结果不计为成功或失败，无耗时样本使用 durationSamples: 0 与 totalDurationMs: 0

### Requirement: 最小本地交付
本变更 SHALL 保持既有 CLI 参数、表格、Skill 去重和过滤行为，使用合成测试及只读子 Agent 审查，并形成可供后续分支使用的本地提交。

#### Scenario: 并行开发准备完成
- **WHEN** 契约完成验收
- **THEN** main 包含契约和验证记录，但不创建两个功能分支或 worktree，不推送、发布或自动归档
