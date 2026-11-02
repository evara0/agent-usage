## Why
默认 Skill 表格和 JSON 仍采用旧按秒/会话统计，与新技能轮次口径不一致。统一入口可避免命令漏写 method 导致结果变化。

## What Changes
- 默认 Skill 模式使用 combined，与显式 method 共用表格、JSON、Markdown 链路。
- 移除旧 Skill 聚合、类型和报告；旧 --strict 在读取前提示迁移。
- 默认支持 evidence 重放与 count policy，保留 MCP、离线 Hook、出处的独立边界。
- **BREAKING** 默认 JSON 改为已有 kind=skill-usage-comparison v1；移除旧源码接口。

## Capabilities
### Modified Capabilities
- skill-statistics: 统一技能轮次统计与 JSON 契约。
- cli-integration: 默认 combined 与独立模式预检。
- usage-contract: 移除旧源码契约，明确新 JSON 身份。
- markdown-report: 允许省略 method。

## Impact
CLI、旧源码接口、合成测试、使用文档和维护卡。无需新增 skill 或 hook，不修改个人采集配置。

## Git Baseline
本地 main 0d36575；代理 7897 连接失败，用户明确授权本次跳过远端同步。不会推送。
