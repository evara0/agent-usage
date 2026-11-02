# Why

Markdown 报告当前走旧 SkillUsageReport 与会话级聚合，和已提供的 logs/hooks/combined 技能轮次统计不一致，且阻碍解除旧统计依赖。用户已授权迁移为新口径。

# What Changes

- Markdown 只消费 SkillComparisonReport，复用上游采集、重放、去重、窗口与计数策略。
- 支持 --skill-method logs|hooks|combined --markdown，使用统一六列和显式时区日期时间，保留未决提示。
- 裸 --markdown、旧 --strict 或 --provenance Markdown 在读取前拒绝并提示迁移，不继续生成旧口径报告。
- 完整导出不受 limit 影响，保留 UTF-8、转义和文件输出行为。

# Capabilities

## Modified Capabilities
- markdown-report：改用技能轮次证据模型。
- cli-integration：允许新模式 Markdown，明确旧入口迁移和参数互斥。

# Impact

影响 src/render/markdown.ts、CLI 路由、相关测试及文档；旧 JSON/表格统计、MCP、离线 Hook 保留。与出处解耦分支可能共同修改 CLI 和说明，集成时需保留两者路由。
