# Proposal

## Why

现有 Skill 表格把不同去重口径的日志信号合为 Total，无法独立比较日志与 Hook，也无法从汇总追查跨来源去重依据。用户已确认先确定人读结果，再反推结构化证据、两种采集入口与验证规则，需要把这一设计形成可验收的变更。

## What Changes

- 增加可选的 Skill 对比模式，提供 logs、hooks、combined 三种视图，统一显示 `Skill / Logs Explicit / Logs Inferred / Hooks / Unique Total / Last Recorded`。
- 新增独立 `kind=skill-usage-comparison`、`schemaVersion=1` 契约，保存源实例、时间范围、逐条证据、规则版本、待核对项与可重算汇总；日期时间按声明时区显示。
- 以同实例、同会话、同轮次、同技能为统计单位；分别处理重复导入、同来源分类和跨来源并集，不沿用旧版按秒或整会话压缩规则。
- 日志适配器保留可核对的原始身份；Hook 侧使用已验证事件产生独立的 Skill 证据导出，不能把现有 Hook 处理器运行摘要当作技能使用记录。
- Codex 或人工整理也可按相同证据格式导入；原始事实、推断、整理方式分别保留，无共同身份的记录进入待核对集合。
- 按用户顺序分期：报告样例与契约 → 两入口独立结果 → 去重与逐项对照 → 根据样本覆盖优化。当前交付仅为规划工件和合成示例，不实施或部署采集。

## Capabilities

### New Capabilities

- `skill-evidence`: Skill 结构化证据、身份与导入校验、按技能轮次归组和双来源去重、可重算报告及三种视图。

### Modified Capabilities

- `cli-integration`: 新增可选 Skill 对比入口及参数边界，保持原默认 Skill、MCP、Hook 运行统计与来源资料兼容。

## Impact

- 后续涉及日志适配器、独立 Skill Hook 证据适配器、导入与校验模块、聚合、表格、JSON 输出和 CLI；复用已有静态解析及文件输出能力。
- 现有 `InvocationEvent` 缺少 turnId、稳定来源记录 ID 和技能身份，不能直接作为新契约；现有 `--hooks` 继续表示 Hook 处理器统计。
- 新契约由 kind 与版本共同识别，既有 SkillUsageReport v1 及默认计数不变；新功能通过显式参数启用。
- 当前不改全局配置、不读取额外私有会话数据库、不安装 Hook、不调用模型、不新增数据库；未来真实 Hook 验证与启用另行取得明确授权。
