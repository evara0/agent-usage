# 公共契约

## 当前范围

公共契约是源码级接口，未建立 npm 库导出。版本常量及 Skill/MCP 类型位于 `src/contracts.ts`，报告组装位于 `src/report.ts`；Hook 与来源类型分别见 `src/hooks-types.ts`、`src/provenance-types.ts`。

## Skill 报告

`createSkillUsageReport(result: AggregateResult, context: ReportContext): SkillUsageReport` 接收已有聚合及调用方提供的上下文，返回可 JSON 序列化的完整报告。函数不读取文件、时钟或时区，不重新聚合、过滤或应用 limit，也不修改输入。totals/skills 复用输入引用，消费方应按只读数据使用；需要修改时先复制。

| 字段 | 口径 |
| --- | --- |
| schemaVersion | 当前为数字 1；不兼容的字段或语义变更必须提升版本 |
| generatedAt | 调用方提供的 ISO 8601 生成时间 |
| source | 固定为 codex |
| windowDays | 滚动 N×24 小时；null 表示全部历史 |
| strict | 本次聚合是否排除推断记录；调用方应传入实际使用的选项 |
| timeZone | daily 分桶使用的运行机器本地 IANA 时区 |
| filesScanned | 原有候选 rollout 数加 history 路径；即使 history 不存在也加 1 |
| elapsedMs | 原有扫描与聚合耗时 |
| totals / skills | 原有全部字段、类型和语义；不受表格 limit 影响 |

`skills` 中每项字段如下；`totals` 包含 invocations、manual、auto 和 skills，分别为总记录数、手动数、自动数和 Skill 数。

| SkillStats 字段 | 含义 |
| --- | --- |
| skill / aliases | 归一化名称 / 保留记录的原始名称别名 |
| total / manual / auto | 记录总数 / 手动数 / 自动数；total = manual + auto |
| inferredAuto | auto 中静态读取推断的子集；明确数 = total − inferredAuto |
| lastUsedAt | 最新保留记录的 ISO 时间，无记录为 null |
| daily / projects / sources | 按本地日期、项目目录、数据来源划分的计数 |

读取器应允许增加字段；不兼容的字段或统计口径变更必须提升 schemaVersion。`SkillStats`、`AggregateResult` 也可从 `src/aggregate.ts` 导入。

timeZone 只解释原有本地日期口径，不重分桶。strict 和时间窗口由采集后的聚合过程兑现，组装函数不校验其真实性。Skill total 仍表示去重后的使用证据，不表示执行成功或任务质量。

## 可选 Skill 来源资料

--provenance 在 SkillUsageReport 顶层增补可选 provenance，内部独立 schemaVersion=1、observedAt、temporalScope=current_reference_only、inventory、associations、diagnostics。默认不增加字段，外层 schemaVersion 保持 1；source/sources 仍表示 Codex 数据来源。Skill 计数、去重、aliases 和项目字段不变，类型位于 src/provenance-types.ts。

每个字段保留声明值、E3 file_declared/U user_declared 证据及 skill/package/user 范围；unknown、declared、conflict 不表示核验认证。关联为当前参考的 unknown/candidate/ambiguous，不含确定历史作者或作者调用次数。结构、严格映射、范围限制见 [Skill 当前来源资料](skill-provenance.md)。

## MCP 类型

`McpCallRecord` 与 Skill 使用事件分开。`source/sessionId/callId` 是一次调用的联合身份；server 不可识别时为 null，tool 保留完整工具名，不猜测服务端。startedAt 为调用尝试的 ISO 时间。

| status | 证据条件 | finishedAt | durationMs |
| --- | --- | --- | --- |
| unknown | 未关联结果或证据不足 | null | null |
| succeeded | 关联到明确成功结果 | 结果 ISO 时间 | 可靠的非负有限耗时或 null |
| failed | 关联到明确失败结果 | 结果 ISO 时间 | 可靠的非负有限耗时或 null |

不从结果文本是否为空推断成功；取消、阻断或超时等证据不足时保留 unknown。只有观测到零耗时才写 0，缺少耗时用 null。无可确认调用身份的孤立结果不生成调用。

`McpAggregateResult` 含 tools 与 totals。按 server/tool 分组，每组与总计均满足 `invocations = succeeded + failed + unknown`。每组 lastUsedAt 为最新调用开始时间；durationSamples 只统计可靠耗时样本，totalDurationMs 为其和。没有样本时两者均为 0，不代表所有调用耗时为零。契约不定义成功率，聚合算法由独立 MCP 模块实现。

这些是 TypeScript 内部类型和语义约定，类型本身不提供运行时验证；独立 MCP 采集器负责时间、身份和结果证据校验，聚合器负责非法输入、计数和耗时样本不变量。不得套用 Skill 的按秒或每会话去重规则。

## Hooks 类型与边界

Hooks 使用独立 HookRecord / HookStats 和 kind=hooks JSON，不复用 Skill 事件与按秒去重规则。联合 thread/run 身份哈希后关联；同步 command/mcpTool 的明确 completed/failed 形成成功/失败，其余保持 unknown。缺失耗时不补零，路径与原始 ID 不输出。输入限定所选 Codex home 下 usage-hooks 的显式单位离线通知；完整字段与质量计数见 [Hooks 统计说明](hooks-statistics.md)。

Skill 来源只增强 Skills；--provenance 及专用输入不能与 --mcp/--hooks 混用，所有模式参数在映射或日志读取前预检。完整测试入口同时包含来源、Hooks 和跨模式回归。

## 维护与验证

修改契约时同步类型、采集/聚合、渲染及消费方测试。检查命令见[维护卡](../MAINTENANCE.md)；CLI 使用及专题文档见 [README](../README.md)。分支基线、集成过程和历史验证保存在[集成验收](../openspec/changes/archive/2026-10-21-integrate-provenance-and-hooks/verification.md)及其他变更归档中。
