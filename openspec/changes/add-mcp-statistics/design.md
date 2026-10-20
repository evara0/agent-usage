## Context

共同基线为 938cb0c278802973fcbf3de60b81f86563c9079b；当前功能仅修改授权的独立模块。现有 codex.ts 验证了 session_meta / response_item 外壳、sessions 和 archived_sessions 布局，但其 Skill 去重规则不适用于 MCP。

核对时间为 2026-10-20。已阅读官方 [MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) 与 [App Server 文档](https://learn.chatgpt.com/docs/app-server)。后者描述 mcpToolCall 的 server/tool/result/error 和生命周期，也明确拒绝或取消批准可产生 error；这些不能推出任意 error 都代表工具执行失败。文档没有保证本地 rollout 持久保存全部字段，本轮不读取真实会话，仅以受控合成样本声明以下兼容结构，不能据此声称任意版本日志均已验证。

## Goals / Non-Goals

**Goals:** 独立提供符合公共契约的保守采集与聚合；暴露覆盖缺口；使重放、乱序及冲突可验证。

**Non-Goals:** CLI/表格接线、配置探测、代码执行分析、外部服务、遥测、成功率、按参数推断嵌套 MCP 调用、App Server 在线订阅及真实日志抽样。

## Decisions

### 支持的受控信号

1. 文件内唯一的 session_meta.payload.id 提供 sessionId，不从路径或父会话猜测身份。元信息可晚于信号出现；多种 session id 的文件整体跳过。
2. response_item.payload 的 function_call 或 custom_tool_call：call_id 与非空 name，name 以 mcp__ 开头。保留完整 name，server 为 null，不拆分名称猜测映射。不解析 arguments/input，不执行其中代码。
3. event_msg.payload 的 mcp_tool_call_begin：call_id 及 invocation.server/tool；此显式映射构造完整工具名 mcp__<server>__<tool>，server 来自字段。与直接调用同身份且完整名称一致时合并；开始时间取最早时间，显式 server 优先。其他名称或 server 冲突使该身份结果降为 unknown，代表项按稳定字段排序选择。
4. response_item 的 function_call_output/custom_tool_call_output：output 为对象或完整 JSON 对象字符串，且根级 content 为数组、isError 为布尔值。只读取结构标志，不检查正文。缺少标志或普通文本为不确定结果。
5. event_msg 的 mcp_tool_call_end：call_id、invocation 和 result.Ok（相同 content/isError 约束）提供明确结果；result.Err、缺失标志或其他形态仅为不确定结果。duration 只接受 {secs: 非负安全整数, nanos: 0..999999999 的整数}，转换为毫秒并验证非负有限。零与缺失区分。结果 invocation 必须与调用的完整工具名及已知 server 一致。
6. 只接受有时区的有效 ISO 时间并归一化为 UTC。不存在调用的结果仅增加孤立结果计数。结果时间早于调用、缺少时间、明确标志冲突或存在不确定终态，均保留 unknown。相同明确状态重复结果取最早有效结束时间；不同可靠 duration 冲突时只丢弃耗时。不用日志时间差代替执行耗时。

不采用默认成功、文本关键词或通用 status 字段判断，因为这些信号不能区分工具错误、传输、取消和批准阻断。保守保留 unknown 的代价是较低的结果覆盖。

### 接口与扫描元信息

collectMcpEvents(codexDir?: string): Promise<McpScanResult>；默认 ~/.codex。返回 events 与 filesScanned（候选 JSONL 文件数）、filesRead（完整读完数）、unreadableFiles、missingDirectories、directoryErrors、malformedLines、invalidSignals、missingSessionFiles、duplicateCalls、conflictingCalls、orphanResults、ambiguousResults。orphanResults 只计可以确认是 MCP 的生命周期孤立结果；无调用的普通 output 无法确认类别，不计入。计数针对扫描信号/身份，具体定义随接口文档交付；不返回正文、参数、结果、文件路径。history.jsonl 不含调用结果，不扫描。文件按路径排序，流式读取每行，文件读取失败时丢弃该文件全部信号。缺失与不可读明确区分，避免报告为完整覆盖。

aggregateMcpEvents(records: McpCallRecord[], opts?: {days?: number}): McpAggregateResult。days 省略为全部历史，提供时必须正且有限；Date.now() 固定一次，按 startedAt 的滚动窗口过滤。验证公共契约后按 JSON 编码的 source/sessionId/callId 去重以避免分隔符碰撞；同身份记录先合并再过滤。unknown 可以由无冲突的明确结果补全；两个明确状态冲突或工具/非空 server 冲突降为 unknown。可靠耗时冲突为 null。输入不被修改。排序为调用数降序、server（null 在前）、tool 的代码点顺序。

聚合器验证运行时字段，非法记录抛出 TypeError，非法 days 抛出 RangeError；总耗时溢出抛出 RangeError，以维持有限数不变量。不增加契约字段，不新增外部依赖。

## Risks / Trade-offs

- [日志格式和持久化随版本变化] → 文档声明精确受控信号，未支持形态保持 unknown/跳过；不声称真实版本覆盖率。
- [缺少 session_meta 或只有孤立结果] → 不猜测身份，不虚构调用，提供计数。
- [嵌套 tools 调用无独立 call_id] → 不从代码文本制造调用，明确漏计限制。
- [跨文件关联占用内存] → 行按流读取，仅保留调用身份与最小结果元信息；不保留参数与正文。
- [相同身份被复用于不同调用] → 稳定选择代表并降级结果，暴露冲突；无法恢复真实调用次数。

## Migration Plan

独立模块完成后提交功能分支供总控集成，不修改现有入口。回退可移除本模块提交。CLI、表格、测试脚本和 README 由总控后续接线；change 不自动归档。
