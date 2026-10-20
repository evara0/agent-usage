# Design

## Context
当前独立 worktree 从 main 的 938cb0c278802973fcbf3de60b81f86563c9079b 开始，分支为 codex/markdown-report。docs/usage-contract.md 定义 SkillUsageReport，完整 skills 不受终端表格 limit 影响。总控持有 CLI、公共契约、package.json 与 README。

## Goals / Non-Goals
提供确定性的纯 Markdown 渲染，便于总控接入输出选项。保留全部排名、长名称和报告上下文，明确证据统计边界。不采集、不重新聚合事件、不按窗口或 strict 再过滤、不修改输入、不读取机器时钟或时区，不导出项目目录和日期明细。

## Decisions
1. 接口置于 src/render/markdown.ts，唯一导出函数为 renderMarkdown(report: SkillUsageReport): string，按现有有效契约输入工作，不新增运行时契约验证器。
2. 概览直接读取 totals；推断总数仅累加各 Skill 已有 inferredAuto，明确记录数为 totals.invocations 减推断总数。每行明确数为 total 减 inferredAuto。auto 包含明确自动注入和推断，不能全部标为推断。
3. 排名在 skills 的浅副本上按 total 降序、同数按 skill.localeCompare 排序，不重新计算统计、不截断列表；时间原样显示 ISO 字符串，null 显示“无记录”，不作时区转换。
4. 元信息包括版本、来源、生成时间、windowDays、strict、timeZone、filesScanned 与 elapsedMs。null 窗口表示全部历史，数值窗口说明 N×24 小时；timeZone 仅说明 daily 原有分桶口径。
5. 对输入字符串的 HTML 与 Markdown 标记字符使用字符实体转义，防止原始 HTML、链接、表格列或反引号改变结构。换行、制表符及 Unicode 行分隔符折叠为空格，去除其余控制字符。长名称不截断。
6. 空 skills 显示无记录提示，仍保留概览、上下文和限制说明。渲染不补造最近使用时间、成功率、失败次数或覆盖率。
7. 本分支显式编译并运行新测试，现有 package.json 的 test 尚未包含新测试。总控后续完成 CLI 参数、测试脚本与 README 接线，任务保持未勾选。

## Risks / Trade-offs
输出依赖支持管道表格的 Markdown 阅读器，字符实体在常见 Markdown 阅读器中显示为原字符。排名的同数名称顺序沿用既有 localeCompare 约定。报告不验证调用方传入的 strict 或窗口是否实际兑现；若上游输入不满足契约，应由上游修复。

## Validation
仅使用内存合成报告及现有 CLI 临时合成日志。覆盖混合证据、上下文、排序、不截断、空统计、null 时间、特殊字符及嵌套冻结输入。顺序执行类型检查、现有测试、显式新测试编译与运行、CLI 回归、OpenSpec 严格校验和差异检查，避免生成目录竞争。验证完成后在功能分支本地提交。

## 总控 CLI 接线
新增布尔参数 --markdown，默认仍为 Skill 表格；与 --json 同时使用时由严格预检在扫描前拒绝。无 JSON 或 Markdown 标志的行为不变。CLI 将同一聚合结果与窗口、strict、时区上下文组装为完整 SkillUsageReport，再交给 JSON 序列化或 renderMarkdown；两种机器/文档输出均无横幅，--limit 仅限制终端表格。新报告测试加入 pnpm run test，CLI 合成回归验证完整输出、strict、空数据及冲突参数。后续 MCP 使用独立选择参数，Markdown 本轮仅适用于 Skill。
