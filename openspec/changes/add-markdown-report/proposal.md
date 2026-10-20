# Markdown 使用报告

## Why
现有完整 SkillUsageReport 只能通过 JSON 被程序消费，需要独立的 Markdown 渲染模块，便于阅读和分享统计，同时保持公共契约及采集口径不变。

## What Changes
- 新增 renderMarkdown(report: SkillUsageReport): string，输出中文概览、统计上下文、完整 Skill 排名、最近记录时间与统计限制。
- 区分明确和推断记录，说明计数不代表执行成功、filesScanned 不代表成功读取数。
- 安全呈现 Markdown 特殊字符、换行、空统计和长名称，使用合成报告验证纯渲染与输入不变性。
- 记录源码调用方式和总控集成待办；本分支不接入 CLI 或修改公共契约。

## Capabilities
### New Capabilities
- `markdown-report`: 从完整 SkillUsageReport 生成可阅读的 Markdown 报告。

## Impact
仅新增 src/render/markdown.ts、tests/markdown.test.ts、docs/markdown-report.md 与本 change。无新增依赖、面板、服务或真实日志采集。不修改 CLI、聚合器、公共类型、主文档或项目脚本；不合并、推送、发布或自动归档。
