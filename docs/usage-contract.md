# 公共契约与后续分工

## 当前范围

公共契约是源码级接口，未增加 npm 库导出。版本常量及类型位于 `src/contracts.ts`，报告组装位于 `src/report.ts`。Skill 聚合算法保持原样；Markdown 渲染已通过 --markdown 接入，见 [使用说明](markdown-report.md)。MCP 采集与聚合已通过 --mcp 接入，见 [使用说明](mcp-statistics.md)。

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

本轮 JSON 只增加 schemaVersion、strict、timeZone 三个字段。允许附加字段的旧读取器可以继续使用原字段；拒绝未知键的外部校验器需要调整。现有 `SkillStats`、`AggregateResult` 仍可从 `src/aggregate.ts` 导入。

timeZone 只解释原有本地日期口径，不重分桶。strict 和时间窗口由采集后的聚合过程兑现，组装函数不校验其真实性。Skill total 仍表示去重后的使用证据，不表示执行成功或任务质量。

## MCP 类型

`McpCallRecord` 与 Skill 使用事件分开。`source/sessionId/callId` 是一次调用的联合身份；server 不可识别时为 null，tool 保留完整工具名，不猜测服务端。startedAt 为调用尝试的 ISO 时间。

| status | 证据条件 | finishedAt | durationMs |
| --- | --- | --- | --- |
| unknown | 未关联结果或证据不足 | null | null |
| succeeded | 关联到明确成功结果 | 结果 ISO 时间 | 可靠的非负有限耗时或 null |
| failed | 关联到明确失败结果 | 结果 ISO 时间 | 可靠的非负有限耗时或 null |

不从结果文本是否为空推断成功；不把取消、阻断或超时自动判成成功或失败。它们需要后续采集设计明确证据与状态，目前证据不足时保留 unknown。只有观测到零耗时才写 0，缺少耗时用 null。没有可确认调用身份的孤立结果不能凭空生成成功调用。

`McpAggregateResult` 含 tools 与 totals。按 server/tool 分组，每组与总计均满足 `invocations = succeeded + failed + unknown`。每组 lastUsedAt 为最新调用开始时间；durationSamples 只统计可靠耗时样本，totalDurationMs 为其和。没有样本时两者均为 0，不代表所有调用耗时为零。契约不定义成功率，聚合算法由独立 MCP 模块实现。

这些是 TypeScript 内部类型和语义约定，类型本身不提供运行时验证；独立 MCP 采集器负责时间、身份和结果证据校验，聚合器负责非法输入、计数和耗时样本不变量。不得套用 Skill 的按秒或每会话去重规则。

## 并行开发交接

两个功能 worktree 从共同基线 938cb0c 启动，独立提交后已由总控按 Markdown、MCP 的顺序验收并合并到 main。功能 worktree 保留；下表为模块与总控的职责边界。

| 工作 | 输入 / 输出 | 修改边界 |
| --- | --- | --- |
| Markdown 报告 | 输入 SkillUsageReport，输出文本 | 新增独立渲染模块、专属测试及对应 OpenSpec change |
| MCP 统计 | 输出 McpCallRecord 与 McpAggregateResult | 新增专属采集、聚合、测试及对应 OpenSpec change |
| 总控集成 | CLI 接线与最终验收 | contracts.ts、report.ts、index.ts、package.json、锁文件与主文档 |

公共接口不足时先反馈总控；各功能不得自行改写公共契约。新增测试需由总控接入项目脚本，不能只创建测试文件而不执行。同一 worktree 内不并行运行会覆盖相同生成目录的构建或测试。

## 验证

在项目目录运行 `pnpm run test`、`pnpm run typecheck`、`pnpm run test:cli`。第一条同时编译类型负例并执行核心与契约测试；CLI 测试使用临时合成日志。两个 change 分别运行 `openspec validate <change-id> --strict --no-interactive`。验收结果见对应 change 的 verification.md，OpenSpec 不自动归档。
