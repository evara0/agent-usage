# Design

## Context
当前 CLI 在入口内拼装 JSON，SkillStats 与 AggregateResult 位于 aggregate.ts；MCP 尚无数据模型。初始本地提交为 060098b86622f86959c7cbfb3e92326cdebd81cd，main 从该提交建立。现有 InvocationEvent 和去重逻辑保持原样。

## Goals / Non-Goals
提供源码级公共契约，使后续报告模块只消费报告对象，MCP 模块只实现独立采集和聚合。此阶段不建立 npm 库导出，不重构适配器，不增加命令、依赖或 MCP 输出字段。

## Decisions
1. src/contracts.ts 定义 SkillStats、AggregateResult、ReportContext、SkillUsageReport、McpCallRecord 与 McpAggregateResult。aggregate.ts 重导出已有类型，保留调用方导入路径。
2. src/report.ts 的 createSkillUsageReport(result, context) 只组装对象，不扫描、读取时钟或决定时区；CLI 提供生成时间和本地 IANA 时区。报告保留 totals/skills 全量数据，不应用表格 limit。
3. JSON 添加 schemaVersion: 1、strict: boolean、timeZone: string。旧字段 generatedAt/source/windowDays/filesScanned/elapsedMs/totals/skills 保持原类型、值语义和嵌套字段。既有消费方应允许附加字段；精确枚举旧 JSON 键的消费方需要调整。未来不兼容的删除、改名或口径改变须提升版本并单独记录变更。
4. daily 仍按运行机器本地日期；timeZone 说明这个日期口径，不进行重分桶。filesScanned 仍为候选 rollout 数加 history 路径，不伪装为成功读取数；本轮不引入无采集证据的覆盖率。
5. MCP 以 source/sessionId/callId 共同标识一次调用，server 不可识别时为 null，保留完整 tool 名称，不从模糊字符串猜测服务端。startedAt 表示调用尝试的 ISO 时间。未匹配结果的记录为 status: unknown，finishedAt/durationMs 均为 null；有明确结果时 status 为 succeeded 或 failed，finishedAt 为结果 ISO 时间，durationMs 为可靠的非负有限耗时或 null。仅类型约束，不新增解析器或运行时数据验证器。
6. MCP 不复用 Skill 的去重与成功口径。按 server/tool 分组；invocations = succeeded + failed + unknown。durationSamples 与 totalDurationMs 仅覆盖有可靠耗时的记录；无样本时两者为 0，不表示调用耗时为零。lastUsedAt 使用调用开始时间。未知结果不进入成功或失败计数；本轮不提供成功率。
7. 更新测试入口，确保新增契约测试实际被 pnpm run test 执行。类型负例由 tsconfig.test.json 编译，CLI 合成日志回归验证默认、strict、窗口、limit 和原字段。

## Parallel Handoff
总控持有 src/contracts.ts、src/report.ts、src/index.ts、package.json、pnpm-lock.yaml 及主文档。后续报告分支消费 SkillUsageReport，新增独立渲染模块及测试；MCP 分支消费 McpCallRecord/McpAggregateResult，新增专属采集、聚合及测试。接口变更先反馈总控。后续分支须从本轮最终提交启动；本轮不启动它们。

## Risks / Trade-offs
附加 JSON 字段兼容允许扩展字段的读取器，不保证与拒绝未知键的外部校验器兼容。MCP 类型只声明约束，不能证明真实日志具备关联或耗时证据。取消、阻断及超时的独立状态留待实际 MCP 需求设计，不能在后续实现中无依据地转成 succeeded/failed。

## Validation
执行核心与契约测试、类型检查、CLI 构建集成测试、两个 OpenSpec change 的严格校验及暂存差异检查；一个子 Agent 只读审查契约、兼容性与范围。仅使用合成数据，不扫描真实 Codex 记录。
