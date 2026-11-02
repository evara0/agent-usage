# markdown-report Specification

## Purpose
将完整 SkillUsageReport 纯渲染为可读 Markdown，并通过 CLI 提供无横幅的完整报告输出，准确解释统计上下文与证据限制，安全处理特殊字符。

## Requirements

### Requirement: 完整报告的纯渲染接口
模块 SHALL 导出 renderMarkdown(report: SkillComparisonReport): string，只消费新的 skill-usage-comparison 完整报告，不采集、不重新聚合或重新筛选技能行、不读取当前时钟或机器默认时区、不修改输入。Markdown MUST 不依赖旧 SkillUsageReport、collectCodexEvents 或旧 aggregate。

#### Scenario: 已冻结的完整报告
- **WHEN** 调用方传入嵌套冻结的新完整报告
- **THEN** 渲染成功且重复调用结果一致，输入对象和数组保持不变，全部 Skill 保留在输出中

### Requirement: 清晰的统计上下文与排名
报告 SHALL 包含 mode、countPolicy、countUnit=skill-turn、生成时间、统计窗口与声明时区，并按上游完整排序展示 Skill、Logs Explicit、Logs Inferred、Hooks、Unique Total、Last Recorded 六列。日期时间 MUST 使用报告 timeZone 格式化为 YYYY-MM-DD HH:mm，不引入旧扫描元信息。

#### Scenario: 有限滚动窗口
- **WHEN** 报告提供合法 period 或全部历史边界
- **THEN** 显示对应窗口或 All time，Last Recorded 按声明时区展示，不重新选择记录

#### Scenario: 全部历史与空统计
- **WHEN** period 为全部历史且 skills 为空
- **THEN** 保留上下文、汇总和空记录说明，不生成记录

#### Scenario: 缺少最近记录时间
- **WHEN** lastRecorded 为 null
- **THEN** 未知时间显示 —，不生成当前时间填充

### Requirement: 明确与推断证据的准确解读
报告 SHALL 直接显示新模型的 logsExplicit、logsInferred、hooks、uniqueTotal，不通过旧 auto/manual/inferredAuto 派生新计数。未选择来源和严格未知 MUST 显示 —，已知零显示 0；当前模式与窗口内的未决候选 SHALL 单列数量，并说明 resolved 排除未决、strict 保留受影响未知。计数不得称为成功次数或完整历史总量。

#### Scenario: 混合证据
- **WHEN** 日志有 2 个明确组、3 个推断组，Hook 有 4 组且共有 3 组
- **THEN** combined 显示 2/3/4/6，logs 与 hooks 保留各自计数和未选列，Markdown 与同条件 JSON 一致

#### Scenario: 未决范围
- **WHEN** 未决候选来自未选来源或窗口外
- **THEN** 不把它计入当前报告未决数量，原始明细仍由 JSON 留存

### Requirement: 安全完整的 Markdown 文本
报告 SHALL 转义来自输入的 Markdown 与 HTML 结构字符，防止名称和元信息破坏表格或注入链接与 HTML，并保留长名称的完整内容。

#### Scenario: 特殊字符与长名称
- **WHEN** 名称或元信息含管道、反引号、链接标记、HTML、换行、控制字符或长文本
- **THEN** 输出不产生额外表格行列、原始 HTML 或可执行链接，单元格保持单行且长名称不被截断

### Requirement: 独立模块交付
本变更 SHALL 使用合成数据验证模块与 CLI，在对应工作树本地提交，不推送、合并或自动归档。

#### Scenario: 模块验收完成
- **WHEN** 渲染器、CLI 及测试完成本地验证
- **THEN** 同步使用说明和迁移提示，并报告源码接口与命令兼容变化

### Requirement: 总控 CLI 输出接线
CLI SHALL 通过 --skill-method logs|hooks|combined --markdown 输出新口径完整报告，支持 skill-evidence、skill-counts、days、codex-dir 和 output。Markdown MUST 无横幅且不受 limit 截断。旧裸 --markdown 与旧 --strict/provenance Markdown MUST 在读取前拒绝并给出迁移形式，保留非 Markdown 旧表格/JSON 行为。

#### Scenario: 完整文档输出
- **WHEN** 使用者指定新 method、--markdown 以及可选窗口、策略、证据包和输出路径
- **THEN** 与新 JSON 使用同一采集和重算模型，输出完整六列表格并保留 UTF-8 文件与错误行为

#### Scenario: 输出冲突
- **WHEN** 使用 --markdown 不带 method，或与 --json、旧 --strict、--provenance 混用
- **THEN** 扫描前非零退出，stdout 为空，输出文件不创建，stderr 说明迁移或互斥原因
