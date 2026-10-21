# MCP 统计模块

本模块提供 TypeScript 源码级的本地 MCP 采集和聚合接口，输出遵循 [公共契约](usage-contract.md)。已接入 CLI 的 --mcp 表格与 JSON 输出，未建立 npm 库导出。只读取已有日志，不调用 MCP 服务，不修改 Codex 配置，也不启用遥测。

## CLI 使用

```powershell
node ./dist/index.mjs --mcp --days 30 --limit 10
node ./dist/index.mjs --mcp --days 30 --json
node ./dist/index.mjs --mcp --days 30 --json --output .local/mcp-usage.json
```

默认仍为 Skill。--mcp 复用 --days、--codex-dir、--limit；与 Skill 专用 --strict 和 --markdown 互斥，冲突在扫描前报错。limit 只截断表格，不改变总计或 JSON。表格展示调用状态、可靠耗时样本均值和全部扫描质量计数；没有耗时样本显示 -，观测零耗时显示 0.00。

JSON 信封包含 schemaVersion: 1、kind: mcp、source: codex、generatedAt、windowDays、elapsedMs、scan、totals、完整 tools。scan 是下述 McpScanResult 去掉 events 的全部计数，反映整个扫描而非仅窗口内调用，不保留参数、正文或文件路径。Skill JSON 不变；本轮 Markdown 仅支持 Skill。

## 接口

```ts
import { collectMcpEvents } from '../src/adapters/mcp.js';
import { aggregateMcpEvents } from '../src/mcp-aggregate.js';

// 建议集成方传入显式目录；省略时读取 ~/.codex。
const scan = await collectMcpEvents('D:/synthetic-codex');
const result = aggregateMcpEvents(scan.events, { days: 30 });
```

`collectMcpEvents(codexDir?: string): Promise<McpScanResult>` 递归扫描根目录下 `sessions` 和 `archived_sessions` 的普通 `.jsonl` 文件，返回 `events: McpCallRecord[]` 及下述计数。`history.jsonl` 不扫描。默认数据目录仅在调用时解析，模块导入不会扫描文件。

`aggregateMcpEvents(records: McpCallRecord[], opts?: McpAggregateOptions): McpAggregateResult` 按 `source/sessionId/callId` 合并记录快照，再按 `server/tool` 聚合。`days` 省略表示全部历史；提供时必须为正有限数，支持小数，使用调用开始时间筛选最近 N×24 小时且包含边界。函数只读取一次当前时间，不改变输入。相同联合身份的开始时间取最早值，再判断窗口，避免重放把旧调用移进窗口。

`McpScanResult` 和 `McpAggregateOptions` 分别从两个模块导出。`parseMcpTimestamp(value: unknown): string | null` 是采集与聚合共用的内部辅助导出，不作为产品接口承诺；它验证带时区的 ISO 时间，拒绝无效日期和本地时间，并归一化为 UTC 毫秒精度。目前只接受 0 至 3 位小数秒。

## 支持的输入结构

以下均为受控合成样本。已核对现有 Skill 采集器使用的 rollout 外壳，以及 OpenAI 官方 [MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) 和 [App Server 文档](https://learn.chatgpt.com/docs/app-server)（核对日期：2026-10-20）。官方 App Server 生命周期并不保证本地 rollout 保存相同字段；本轮没有读取真实会话，也未对具体 Codex 版本作兼容性认证。

每个文件必须有且仅有一种非空 `session_meta.payload.id`，重复同一 id 允许，元信息可晚于调用。缺失或相互冲突时整文件跳过。不会使用文件名、父会话或任意文本补全身份。

直接调用接受 `response_item.payload.type` 为 `function_call` 或 `custom_tool_call`，非空 `call_id` 和以 `mcp__` 开头的非空 `name`。工具全名原样保留，`server` 为 `null`，不会从工具名拆分猜测 server。

```json
{"type":"session_meta","payload":{"id":"synthetic-session"}}
{"type":"response_item","timestamp":"2026-10-19T08:00:00Z","payload":{"type":"function_call","call_id":"synthetic-call","name":"mcp__sample__lookup"}}
{"type":"response_item","timestamp":"2026-10-19T08:00:01Z","payload":{"type":"function_call_output","call_id":"synthetic-call","output":{"content":[],"isError":false}}}
```

直接结果接受 `function_call_output` 或 `custom_tool_call_output`，`output` 必须是完整对象或完整 JSON 对象字符串，且根级具有 `content` 数组和显式 `isError` 布尔值。`false` 表示 `succeeded`，`true` 表示 `failed`。不解析内容数组的正文来判断结果。直接结果无法提供可靠执行耗时，所以 `durationMs` 为 `null`，即使日志时间差恰好为零也一样。

受控生命周期结构接受 `event_msg.payload.type` 为 `mcp_tool_call_begin/end`，具有 `call_id` 与明确的 `invocation.server/tool`。这两个字段构造统一的工具全名 `mcp__<server>__<tool>`，`server` 使用显式字段。若同身份的直接调用工具全名相同，则合并两种信号。

```json
{"type":"event_msg","timestamp":"2026-10-19T08:00:00Z","payload":{"type":"mcp_tool_call_begin","call_id":"synthetic-call","invocation":{"server":"sample","tool":"lookup"}}}
{"type":"event_msg","timestamp":"2026-10-19T08:00:01Z","payload":{"type":"mcp_tool_call_end","call_id":"synthetic-call","invocation":{"server":"sample","tool":"lookup"},"result":{"Ok":{"content":[],"isError":false}},"duration":{"secs":0,"nanos":0}}}
```

`result.Ok` 应符合上述明确结果约束，且不能同时存在 `Err`。`result.Err`、缺失标志、未知结构、普通文本、取消、批准阻断和超时均保留 `unknown`。这是保守统计边界，不说明这些工具实际执行成功或失败。

只有已确认结果的生命周期 `duration` 可作为耗时证据：`secs` 为非负安全整数，`nanos` 为 `[0, 1000000000)` 内的整数；换算为毫秒后必须非负有限。零值保留为观测样本，缺失或非法值为 `null`。不从日志时间差或结果正文提取耗时。

## 关联和聚合口径

- 以完整 `source/sessionId/callId` 身份关联，支持结果先出现及当前/归档文件间的重复与重放。不同会话使用相同 callId 独立计数，同一会话同一秒的不同 callId 也独立计数。
- 相同身份的调用工具或明确 server 冲突时，该调用结果降为 `unknown`，工具代表项按稳定字典序选择；存在多个冲突 server 时为 `null`。冲突可能意味着日志复用身份，模块无法恢复真实调用数量。
- 采集器遇到结果时间无效/早于调用、结果元信息不匹配、明确状态冲突，或混有不确定终态时，保留 `unknown`，`finishedAt/durationMs` 均为 `null`。相同明确状态重复结果取最早有效结束时间，可靠耗时不同则只丢弃耗时样本。
- 聚合器处理的是符合契约的记录快照：`unknown` 可由无冲突的明确快照补全；两个明确状态冲突或工具/server 冲突则降为 `unknown`。输入快照丢失了原始信号原因，聚合器不能恢复采集器曾经看到的冲突证据；建议一次完整扫描后聚合。
- `invocations = succeeded + failed + unknown`，组内和总计均成立。`lastUsedAt` 使用调用开始时间。`durationSamples` 仅计可靠样本，`totalDurationMs` 为其和；两者为 0 不代表全部调用耗时为零。
- 分组按调用数降序，再按 server（`null` 在前）和 tool 的代码点顺序排列。非法记录抛出 `TypeError`，非法 `days` 或分组耗时求和溢出抛出 `RangeError`，不会静默生成有效外观的统计结果。

## 扫描元信息

计数不包含参数、会话正文、结果正文或本地文件路径，不能作为日志完整覆盖率。

| 字段 | 含义 |
| --- | --- |
| filesScanned | 两个扫描目录中发现的候选普通 JSONL 文件数 |
| filesRead | 完整读完的文件数；包括缺失/冲突 session 元信息而被跳过的文件 |
| unreadableFiles | 打开或读取失败的文件数；该文件的所有调用与结果信号均丢弃 |
| missingDirectories | 两个扫描根目录中返回 ENOENT 的数量 |
| directoryErrors | 扫描目录时其他错误的数量，包括传入的 sessions 实际为文件 |
| malformedLines | 无法解析 JSON 或顶层不是对象的非空行数；纯空白行忽略 |
| invalidSignals | 已识别信号缺少身份、时间或生命周期映射等字段的数量；一个信号最多加 1，无法确认是 MCP 的普通调用名不计入 |
| missingSessionFiles | 完整读完但 session id 缺失或冲突的文件数 |
| duplicateCalls | 每个接受的联合调用身份超过第一个的调用信号数，含直接调用与生命周期的重复及重放 |
| conflictingCalls | 工具名或显式 server 互相冲突的联合调用身份数 |
| orphanResults | 没有接受调用的 MCP 生命周期结果身份数；普通 output 单独出现时无法证明是 MCP，故不计入 |
| ambiguousResults | 具有结果信号，但没有可确认且无冲突结果的调用身份数；完全缺失结果的不计入 |

文件读取失败前已经发现的损坏行/无效信号计数仍会保留，故扫描计数不等于接受事件的数量。未关联的普通 output 暂时保留最小元信息用于跨文件匹配，最终不会生成调用。

## 覆盖限制与验证

调用统计仅反映受支持日志信号。`functions.exec` 或其他代码封装内的嵌套 MCP 调用、没有独立 callId 的信号、独立 App Server 通知流、遥测数据和非上述格式均未覆盖。不扫描用户配置恢复服务端映射，不将同名工具全局合并，不应用 Skill 的按秒或每会话去重规则。

主入口仍为 Skill 统计，--mcp 显式选择 MCP。CLI/表格、扫描质量展示、统一测试入口与主 README 已由总控集成；各项限制仍适用于 CLI 输出。

新测试已加入 pnpm run test，MCP CLI 测试已加入 pnpm run test:cli；也可独立编译执行模块测试：

```powershell
node node_modules/typescript/bin/tsc -p tsconfig.test.json --outDir .local/mcp-test-dist
if ($LASTEXITCODE -ne 0) { throw 'MCP 测试编译失败' }
node --test .local/mcp-test-dist/tests/mcp.test.js
```

完整验证还包括现有 `pnpm run typecheck`、`pnpm run test`、`pnpm run test:cli`、`openspec validate add-mcp-statistics --strict --no-interactive` 和 `git diff --check`。生成目录与其他命令顺序运行，避免相互覆盖。所有数据验证仅使用临时合成日志。
