## Why

公共契约已经定义 MCP 调用和聚合结果，但目前无法从本地日志生成这些记录。需要一个保守、只读、可独立验证的模块，为后续 CLI 集成提供调用数量、明确结果及可靠耗时样本。

## What Changes

- 增加当前及归档 rollout 的 MCP 采集器，区分调用、明确结果与证据不足。
- 按联合调用身份合并重放、重复与乱序信号；不使用 Skill 时间窗口去重。
- 增加按 server/tool 的聚合及滚动时间筛选，保持公共计数和耗时不变量。
- 使用受控合成样本验证数据覆盖边界，记录扫描元信息与后续集成事项。

## Capabilities

### New Capabilities

- `mcp-statistics`：本地 MCP 调用的保守采集、关联、去重及聚合。

### Modified Capabilities

无。公共契约和现有 Skill 行为保持原样。

## Impact

新增 src/adapters/mcp.ts、src/mcp-aggregate.ts、tests/mcp.test.ts 和 docs/mcp-statistics.md。不增加依赖，不接入 CLI、表格或持久服务，不修改公共契约和其他功能模块，不启用遥测或改变 Codex 配置。
