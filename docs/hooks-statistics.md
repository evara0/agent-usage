# Hooks 离线统计

`--hooks` 只读导入已经保存的同步 Hook 通知，提供调用去重、分组、结果与耗时样本统计。**本工具不采集正在运行的 Codex，不安装 Hook，不修改配置。** 没有导入记录时输出空结果和覆盖说明，不把配置存在视作执行。

## 来源与真实验证范围

2026-10-21 已实际打开以下 OpenAI Docs 官方页面：

- [Hooks](https://learn.chatgpt.com/docs/hooks)：生命周期和信任要求；配置、启用和信任不等于运行证据。
- [App Server](https://learn.chatgpt.com/docs/app-server)：同步 `hook/started` / `hook/completed` 通知；异步 Hook 不发这两种通知。文档没有保证它们持久写入会话日志。
- [Advanced Configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)：`codex.hooks.run` 是计数，`codex.hooks.run.duration_ms` 是直方图，维度为 `hook_name`、`source`、`status`。这些聚合不能变成带 runId 的调用记录，本功能不导入这些指标。

本机 `codex-cli 0.163.0-alpha.10.2` 通过 `codex app-server generate-ts --out <本地临时目录>` 和 generate-json-schema 导出了 HookRunSummary、HookRunStatus、HookEventName 等类型。该操作本身不启动服务器或会话。字段类型与枚举已对照该版本；后续另完成一次真实同步 SessionStart command Hook 通知验证，见本文末尾及[链路记录](live-hook-validation.md)。合成测试和单次实际样本均不代表全面兼容认证。

只读抽样的 5 个本地会话均报告上述版本，未发现 Hook 生命周期类型。最近 2000 条本地日志没有 Hook target/metric。6 个 SQLite 中 5 个可读且没有 Hook 表/列，1 个不可读；这不排除通用表或其他文件中仍有相关证据。用户配置中存在 Hook，但不能推断执行。本轮未复制真实日志入库，也未输出会话正文、命令、配置秘密。**因此当前没有可证实的原生持久运行数据。** 若需要自动持续统计，采集方案、部署与权限需另行确认；本轮未部署。

## 输入协议

扫描 `<codex-dir>/usage-hooks/**/*.jsonl`，默认 codex-dir 为 `~/.codex`。`usage-hooks` 是本工具约定的**离线导入目录，不是 Codex 原生目录**。仅放入已经授权取得的通知导出，勿将会话正文或配置文件作为通知导入。没有现成导出时无需创建该目录，CLI 会报告 `no-imports`。

每个文件第一条非空行必须声明协议和时间戳单位：

```json
{"type":"agent_usage_hook_import","schemaVersion":1,"timestampUnit":"unix-ms"}
```

也支持 `unix-s`。生成类型仅注明 startedAt/completedAt 是整数，未明确单位，故**导出方须核实并声明单位**；本工具不根据数字大小猜测。durationMs 固定为毫秒。首行缺失或不支持时，整个文件不产生记录，增加 unsupportedFiles。

后续每行是官方通知外壳 `{ "method": "hook/started" | "hook/completed", "params": { "threadId": "…", "run": { … } } }`，只读取以下白名单字段：

| 字段 | 约束与用途 |
| --- | --- |
| params.threadId / run.id | 非空字符串；联合身份，立即哈希，不用于猜测其他会话 |
| run.eventName | preToolUse、permissionRequest、postToolUse、preCompact、postCompact、sessionStart、sessionEnd、userPromptSubmit、subagentStart、subagentStop、stop、interrupt |
| run.handlerType | command 或 mcpTool；prompt/agent 不计执行 |
| run.executionMode | 仅 sync；async 不在支持范围 |
| run.source | 官方 HookSource 枚举；缺失为 unknown；与顶层报告 source=codex 分开 |
| run.sourcePath | Windows 或 POSIX 绝对路径；立即 SHA-256，原路径不进入记录 |
| run.displayOrder | 非负安全整数；辅助区分同源多个 handler |
| run.startedAt / completedAt | 按声明单位解析的非负安全整数，日期不超出四位年份；结束不得早于开始 |
| run.status | started 必须 running；completed 的明确 completed→succeeded、failed→failed；blocked/stopped/未识别值→unknown |
| run.durationMs | 非负安全整数毫秒；缺失为 null，零为有效样本 |

source 枚举：system、user、project、mdm、sessionFlags、plugin、cloudRequirements、cloudManagedConfig、legacyManagedConfigFile、legacyManagedConfigMdm、unknown。其他来源值拒绝并计入 invalidSignals。

以下是**合成样例**，用于说明输入，不是本机执行记录：

```jsonl
{"type":"agent_usage_hook_import","schemaVersion":1,"timestampUnit":"unix-ms"}
{"method":"hook/started","params":{"threadId":"synthetic-thread","run":{"id":"run-a","eventName":"stop","handlerType":"command","executionMode":"sync","scope":"turn","source":"project","sourcePath":"/synthetic/.codex/hooks.json","displayOrder":0,"status":"running","startedAt":1792454400000,"completedAt":null,"durationMs":null,"entries":[]}}}
{"method":"hook/completed","params":{"threadId":"synthetic-thread","run":{"id":"run-a","eventName":"stop","handlerType":"command","executionMode":"sync","scope":"turn","source":"project","sourcePath":"/synthetic/.codex/hooks.json","displayOrder":0,"status":"completed","startedAt":1792454400000,"completedAt":1792454400010,"durationMs":10,"entries":[]}}}
```

不读取 entries 文本、statusMessage、命令、工具参数、stdout/stderr、Hook 输入或配置正文。结果依据 Hook 运行摘要的专用状态，而非 JSON-RPC 传输完成、批准决策、受管控工具状态或非空文本。blocked/stopped 可有结束时间与可靠耗时，但结果仍为 unknown；不计算成功率。

## 关联、分组与窗口

调用身份是 SHA-256(JSON([codex, threadId, run.id]))。同一身份的 started/completed 可跨文件、乱序；精确重放只计一次。单独 completed 摘要包含 startedAt 和运行身份，形成明确摘要记录，同时计 completionOnlyRuns。缺失完成保留 unknown，不从文本生成结束。

Hook 分组 ID 来自源路径哈希、配置 source、displayOrder、eventName、handlerType。路径或 displayOrder 变化会拆组，无法跟踪配置编辑后的同一脚本；路径差异也不能判断脚本是否相同。来自不同主机的导出应分别统计。终端只显示 ID 前 12 位，JSON 提供完整 64 位，不显示脚本名称或路径。哈希是信息最小化措施，不保证匿名性。

同一调用不同 Hook/开始时间、冲突终态、冲突结束时间或无效结果，使状态降为 unknown 且丢弃耗时；仅耗时冲突则保留结果、丢弃耗时。不同线程同一 run.id 保持独立。先关联去重再按 startedAt 筛选最近 N×24 小时，起点包含边界。

`Calls = Succeeded + Failed + Unknown`。均值为 totalDurationMs / durationSamples，分母不是所有调用。缺失样本显示 `-`；观测零耗时显示 `0.00`。不使用日志起止时间差推算运行耗时。

## 接口与输出

- `collectHookEvents(codexDir?: string): Promise<HookScanResult>`：返回 records、scan、coverage；只做离线读取。
- `aggregateHookEvents(records, {days?}): HookAggregateResult`：验证独立 HookRecord，合并重复快照、过滤窗口、稳定分组，不修改输入。非法记录抛 TypeError、非法 days 或耗时溢出抛 RangeError。
- `renderHooksTable(result, options)`：行数限制不改变汇总；展示耗时样本数和覆盖信息。

JSON 信封：schemaVersion=1、generatedAt、source=codex、kind=hooks、windowDays、elapsedMs、scan、coverage、totals、完整 hooks。每组包含 hookId、event、configSource、handler、调用/结果计数、lastUsedAt、durationSamples、totalDurationMs。不会导出 records、运行 ID 或原路径。

```powershell
node ./dist/index.mjs --hooks --days 30
node ./dist/index.mjs --hooks --codex-dir "D:/Codex Data/.codex" --limit 0
node ./dist/index.mjs --hooks --json --output .local/hooks.json
```

--hooks 与 --mcp、--strict、--markdown、--provenance 扫描前互斥；--output 要求 --json。保存文件复用现有输出器，直接写无 BOM UTF-8，覆盖目标且自动创建父目录；成功时 stdout 为空。Skill/MCP JSON、Markdown 和统计口径不变。

## 扫描质量与覆盖

scan 为整次扫描计数，不随 days 过滤，也不是完整覆盖率。

| 字段 | 含义 |
| --- | --- |
| filesScanned / filesRead | 候选 jsonl / 完整读完文件数；不含配置、rollout 或 history |
| missingDirectories / directoryErrors | 缺失 usage-hooks / 其他目录错误 |
| unreadableFiles | 读取失败文件数；该文件记录丢弃 |
| unsupportedFiles | 没有支持的协议/单位首行；可与 filesRead 同时增加 |
| malformedLines | 非空行解析失败或不是对象，包括损坏首行 |
| invalidSignals | 已识别通知缺必要身份/时间/来源等，或结果不能可靠解释 |
| unsupportedSignals | 未支持 hook/* 方法、async 或 prompt/agent handler |
| startedSignals / completedSignals | 解析接受的开始/完成信号观察数，重放未扣除；读到一半失败时仍是已观察信号数 |
| duplicateSignals | 同调用完全相同的最小投影重放数；开始+完成互补不算重复 |
| conflictingRuns | 同调用不同 Hook 身份或开始时间 |
| ambiguousResults | 存在结束但结果/时间或身份冲突的调用数 |
| missingResults | 没有完成信号的调用数 |
| completionOnlyRuns | 只有完成摘要而没有开始通知的调用数；不是捏造孤立结果 |
| invalidDurations / conflictingDurations | 无效耗时信号 / 多个不一致耗时的调用数 |

coverage 固定声明 input=offline-app-server-notifications、nativePersistenceVerified=false、asyncCovered=false、timestampUnitRequiresDeclaration=true；availability 仅说明有没有候选导入文件，**不表示文件有效或数据完整**。notes 解释无记录、合成兼容和配置不等于执行的限制。未支持的原生日志与聚合遥测不被伪装为调用。

正式脚本中的测试使用临时合成输入，涵盖关联、重放、乱序、冲突、缺失、阻断/停止、耗时、损坏、隐私、窗口、分组、表格、参数和 UTF-8 输出。来源增强及其专用输入仅适用于 Skills，不能与 --hooks 混用，非法组合在读取映射或日志前拒绝。

另已在本机 codex-cli 0.163.0-alpha.10.2 完成一次真实同步 SessionStart command Hook 验证：首次 turn 阶段获得匹配的开始/完成通知和执行标记，核实当前样本时间戳为 Unix 秒，统计为调用 1、成功 1、耗时 756 ms、质量错误为零。见[验证记录](live-hook-validation.md)。此单次样本不认证其他版本、全部事件、异步覆盖、原生历史持久化或持续采集，不能据此报告个人完整历史成功率。
