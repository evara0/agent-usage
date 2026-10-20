# 建立并行开发的最小公共契约

## Why
Markdown 报告与 MCP 统计即将独立开发，需要共同的报告输入、MCP 记录身份及结果口径，避免两条分支分别修改 CLI 和公共类型。现有 Skill 采集和聚合已完成本地验收，首先以提交 060098b 建立 main 基线。

## What Changes
- 提取 Skill 聚合与报告公共类型，保留原导入路径的类型重导出。
- 为现有 JSON 添加 schemaVersion、strict 和 timeZone，并通过无采集副作用的函数组装报告；原字段、参数和聚合口径保持兼容。
- 定义独立的 MCP 调用及聚合类型，明确 sessionId/callId 关联、未知结果和缺失耗时。
- 用合成数据和类型检查验证契约，安排一个子 Agent 只读审查；在 main 完成本地提交。

## Capabilities
### New Capabilities
- `usage-contract`: 供报告与 MCP 模块共享的最小内部源码契约。

## Impact
涉及公共类型、报告组装、CLI JSON 接线、测试入口及维护文档。不增加运行依赖，不实施 Markdown 渲染、MCP 采集、数据库、服务、健康诊断或自进化。本阶段不创建功能分支或 worktree，不推送、发布或自动归档。

首轮 add-skill-statistics 的“不提交”约束描述当时的交付阶段；本次按用户后续明确授权建立本地提交，不改变原验收记录所记载的历史事实。
