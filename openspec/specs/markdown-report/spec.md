# markdown-report Specification

## Purpose
将完整 SkillUsageReport 纯渲染为可读 Markdown，并通过 CLI 提供无横幅的完整报告输出，准确解释统计上下文与证据限制，安全处理特殊字符。

## Requirements

### Requirement: 完整报告的纯渲染接口
模块 SHALL 导出 renderMarkdown(report: SkillUsageReport): string，只消费已有完整报告，不采集、不重新聚合或过滤记录、不读取时钟或时区，不修改输入。

#### Scenario: 已冻结的完整报告
- **WHEN** 调用方传入嵌套冻结的完整报告
- **THEN** 渲染成功且重复调用结果一致，输入对象和数组保持不变，全部 Skill 保留在输出中

### Requirement: 清晰的统计上下文与排名
报告 SHALL 包含概览、版本、来源、生成时间、统计窗口、strict、日期分桶时区、扫描元信息，以及按记录数降序和同数名称顺序排列的完整 Skill 排名与最近记录时间。

#### Scenario: 有限滚动窗口
- **WHEN** 报告提供非空 windowDays 和 strict 状态
- **THEN** 显示 N×24 小时的滚动口径和实际 strict 值，说明 timeZone 仅解释日期分桶，最近记录时间保留输入 ISO 值

#### Scenario: 全部历史与空统计
- **WHEN** windowDays 为 null 且 skills 为空
- **THEN** 显示全部历史、零统计及无记录提示，并保留上下文与统计限制

#### Scenario: 缺少最近记录时间
- **WHEN** 某个 Skill 的 lastUsedAt 为 null
- **THEN** 对应单元格显示无记录，不推断或生成时间

### Requirement: 明确与推断证据的准确解读
报告 SHALL 使用 total 减 inferredAuto 表示明确记录，使用 inferredAuto 表示推断记录，说明 auto 包含明确自动注入与推断，所有计数均不代表执行成功；filesScanned SHALL 解释为候选 rollout 数加 history 路径，即使 history 缺失仍加一。

#### Scenario: 混合证据
- **WHEN** 某个 Skill 有手动、明确自动注入及推断记录
- **THEN** 概览与排名正确区分明确和推断，且不将全部 auto 当作推断或给出成功率

### Requirement: 安全完整的 Markdown 文本
报告 SHALL 转义来自输入的 Markdown 与 HTML 结构字符，防止名称和元信息破坏表格或注入链接与 HTML，并保留长名称的完整内容。

#### Scenario: 特殊字符与长名称
- **WHEN** 名称或元信息含管道、反引号、链接标记、HTML、换行、控制字符或长文本
- **THEN** 输出不产生额外表格行列、原始 HTML 或可执行链接，单元格保持单行且长名称不被截断

### Requirement: 独立模块交付
本变更 SHALL 使用合成数据验证并在 codex/markdown-report 本地提交，保留总控的 CLI、测试入口和 README 集成为待办。

#### Scenario: 模块验收完成
- **WHEN** 模块及新测试完成本地验证
- **THEN** 本分支只提交授权文件，不修改公共契约与 CLI，不推送、合并或自动归档

### Requirement: 总控 CLI 输出接线
总控集成 SHALL 提供 --markdown 输出完整 Skill Markdown 报告，保留原表格与 JSON 行为，并将报告测试加入正式测试入口。

#### Scenario: 完整文档输出
- **WHEN** 用户使用 --markdown 以及可选的 --days、--strict、--codex-dir、--limit
- **THEN** 标准输出以报告标题开始，无 CLI 横幅，包含完整排名，limit 不截断文档，窗口与 strict 正确传入

#### Scenario: 输出冲突
- **WHEN** --markdown 与 --json 同时使用
- **THEN** 在扫描日志前以非零状态退出，stdout 为空，stderr 解释互斥选项
