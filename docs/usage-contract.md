# 公共契约

## 当前范围

公共契约是源码级接口，未建立 npm 库导出。MCP 类型位于 `src/contracts.ts`，Skill 类型和报告组装位于 `src/skill-evidence-types.ts`、`src/skill-evidence.ts`；Hook 与来源类型分别见 `src/hooks-types.ts`、`src/provenance-types.ts`。

## Skill 报告

默认查询及 --skill-method logs|hooks|combined 均返回 SkillComparisonReport，kind=skill-usage-comparison、schemaVersion=1，省略 method 时为 combined。计数单位为 skill-turn，唯一身份为 sourceInstanceId/sessionId/turnId/skillKey。

skills 与 totals 使用 logsExplicit、logsInferred、hooks、uniqueTotal；每项含 skillKey、skill、lastRecorded。period 表示时间窗口，timeZone 解释展示时间；evidence、deduplication.unresolvedEvidence 与 comparison 保留重算和核对依据。完整契约见 [双来源统计](skill-comparison.md) 和 schemas/skill-evidence-v1.schema.json。

旧 SkillUsageReport、SkillStats、AggregateResult、createSkillUsageReport 及旧采集聚合接口已移除。旧 JSON 的 total/manual/auto/inferredAuto、daily/projects/aliases、windowDays/filesScanned/elapsedMs 不再输出，调用方必须按 kind 识别新报告，不能只检查 schemaVersion=1。新报告沿用独立已发布的 comparison v1，未将旧 JSON 静默改名为相同结构。旧统计按秒/会话去重，不能与新技能轮次数直接比较。

--strict 已移除并在读取前给出迁移提示；--skill-counts strict 是未决计数策略，不是旧排除推断选项。--skill-evidence 与 --skill-counts 可在默认 Skill 模式直接使用，MCP、离线 Hook、出处模式不能混用。

## 独立 Skill 出处清单

--provenance 输出独立 schemaVersion=2、kind=skill-provenance-inventory，包含 observedAt、temporalScope=current_reference_only、sourceInstanceId、skills、diagnostics。skills 遍历全部本机映射，不读取使用日志；每项包括 skillKey、names、当前状态、逐路径摘要与元数据、用户声明。类型位于 src/provenance-types.ts。

每个字段保留 file_declared/user_declared 证据及 skill/package/user 范围；unknown、declared、conflict 不表示核验认证。条目状态为 present/missing/unmapped/unresolved/ambiguous；不同现存路径分别保留，不含使用计数或历史作者归属。结构、声明和边界见 [Skill 出处清单](skill-provenance.md)。旧 v1 旁路关联类型及低层渲染暂作兼容保留，但出处 CLI 不再使用。

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

Skill 出处独立于用量；--provenance 不能与使用时间、strict、Markdown、MCP/Hook 或新 Skill 统计模式混用，旧扫描根迁至 skills refresh。所有参数在配置和元数据读取前预检；完整测试入口包含出处、Hook 与跨模式回归。

## 维护与验证

修改契约时同步类型、采集/聚合、渲染及消费方测试。检查命令见[维护卡](../MAINTENANCE.md)；CLI 使用及专题文档见 [README](../README.md)。分支基线、集成过程和历史验证保存在[集成验收](../openspec/changes/archive/2026-10-21-integrate-provenance-and-hooks/verification.md)及其他变更归档中。

## 统一输出

表格、JSON 与 Markdown 使用同一 SkillComparisonReport；--limit 只截断终端表格。renderMarkdown 接收该报告，不重新采集。缺少本机配置时提示 setup，不回退旧日志统计。MCP 的 schemaVersion=1 与 kind=mcp 保持不变。
