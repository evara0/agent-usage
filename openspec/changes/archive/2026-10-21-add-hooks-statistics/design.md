## Context

基线为 `7b1891e6fecaaa186c9918c25a641455aec560aa`，本 worktree 使用 `codex/hooks-statistics`。调查日期为 2026-10-21。

已实际打开官方 [Hooks](https://learn.chatgpt.com/docs/hooks)、[Advanced Configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)、[App Server](https://learn.chatgpt.com/docs/app-server) 文档。前者描述生命周期及信任要求；后两者分别列出 Hook 计数/直方图和同步 `hook/started`、`hook/completed` 通知，不保证其落入 rollout。异步 Hook 不发这两个通知。不能从遥测聚合生成调用记录。

本机 CLI `0.163.0-alpha.10.2` 的 generate-ts / generate-json-schema 子命令已离线导出协议；没有启动服务器、线程或 Hook。HookRunSummary 包含 id、eventName、handlerType、executionMode、source、sourcePath、displayOrder、status、startedAt、completedAt、durationMs；时间戳单位未由生成类型说明，因此导入必须显式声明单位。抽样 5 个同版本会话未发现 Hook 生命周期类型；近期 2000 行日志没有 Hook target/metric；5 个可读 SQLite 没有 Hook 表/列，另 1 个不可读。用户级配置存在只证明配置。上述调查不能证明其他文件或版本没有执行数据。

## Goals / Non-Goals

Goals：提供可用的离线导入、最小记录和完整 CLI；无数据时空结果及可解释覆盖；合成测试验证边界。

Non-Goals：安装/启用/信任 Hook、采集部署、在线订阅、遥测导出、任意日志文本解析、成功率、异步覆盖、原生日志全面兼容认证、从命令正文识别身份。

## Decisions

### 明确的离线输入边界

读取所选 Codex 目录下 `usage-hooks/**/*.jsonl`。这是本工具的离线导入约定，**不是 Codex 默认持久目录**。不自动扫描会话正文、SQLite、配置或 Hook 输出。调用方必须已有合法保存的通知；本工具不生成或部署其生产者。

每个文件第一条非空行必须是 `{ "type": "agent_usage_hook_import", "schemaVersion": 1, "timestampUnit": "unix-ms" }`，单位也支持 `unix-s`。这项声明由导出方负责核实；没有声明的通知不猜单位、不接收。其余行只读取官方通知 `{method, params:{threadId, turnId?, run}}` 的白名单字段，不保留 entries、statusMessage、命令、参数或正文。源路径在内存即 SHA-256；不输出原路径。

### 身份、结果与耗时

联合身份为 source=codex、threadId、run.id，均以 JSON 数组编码避免碰撞。Hook 分组身份由 sourcePath 的 SHA-256、配置 source、displayOrder、eventName、handlerType 构成并再次哈希。不从缺失字段或普通文本猜身份。displayOrder 调整或源路径变化会拆组，不能可靠追踪配置编辑前后的同一脚本；不同导入主机须分开统计。

只接收 sync 的 command/mcpTool 运行通知；prompt/agent 目前跳过执行，不计调用。`hook/started` 必须是 running；完成通知只能使用明确终态，单独完成通知的 summary 也包含明确开始证据，可形成记录。结果来自 HookRunSummary.status：completed → succeeded，failed → failed；blocked/stopped/未知状态 → unknown。这是 Hook 运行状态，不是工具/transport 完成、批准决策或输出文本；不推断被 Hook 管控工具的结果。

同身份重放去重，开始时间取最早，但不同明确开始时间或不同 Hook 身份视为冲突，状态 unknown，保留质量计数。开始与结束可乱序、跨文件。有效结束早于开始、结束时间冲突、不同终态或未识别终态均保留 unknown；取消/阻断保留结束时间但不算成功/失败。缺失结束不填零。只采纳非负安全整数 durationMs，不用时间差推算；零是样本，缺失不是。冲突身份或终态丢弃耗时；仅耗时冲突丢弃耗时并单独计数。

### 聚合与 CLI

HookRecord 与 HookStats 独立于公共 contracts/report。collectHookEvents 返回 records 与扫描质量、固定覆盖说明；aggregateHookEvents 依据 startedAt 的滚动天数过滤，按稳定 Hook 身份分组，计算 invocations/succeeded/failed/unknown、durationSamples/totalDurationMs、lastUsedAt。记录先关联去重再过滤。

`--hooks` 与 `--mcp` 互斥，与 Skill 专用 `--strict`/`--markdown` 在扫描前拒绝。JSON 信封 schemaVersion=1、kind=hooks、source=codex、generatedAt、windowDays、elapsedMs、scan、coverage、totals、hooks；JSON 不输出调用级身份及记录。表格显示分组、事件、配置来源、handler、调用/结果/耗时样本与均值。limit 仅截断表格。复用未修改的 emitReport 直接写 UTF-8。

## Risks / Trade-offs

- 无现成通知导出 → 默认空结果，不能冒称本地使用覆盖率；持续采集另行设计授权。
- 生成 schema 只验证字段，不是实际通知样本 → 声明合成兼容边界和时间单位前提。
- SHA-256 仅用于不暴露原路径，不是匿名化保证；目录重命名会改变分组。
- 未知终态可能来自取消/策略阻断 → 单独 unknown；无成功率指标。
- 新版本字段变化 → 未支持信号计入质量，原始正文不进入返回值或仓库。

## Migration Plan

在本地分支交付并提交，不合并、不推送、不归档。新增测试接入正式脚本，顺序执行完整 test/typecheck/test:cli、OpenSpec strict 与 diff 检查。现有 Skill/MCP 不改公共模块。
