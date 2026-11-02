## MODIFIED Requirements
### Requirement: 公共报告契约
系统 SHALL 使用 SkillComparisonReport 作为唯一 Skill 输出契约，移除旧 SkillUsageReport、SkillStats、AggregateResult 与 createSkillUsageReport。JSON MUST 由 kind=skill-usage-comparison 与 schemaVersion=1 联合识别；默认与显式 combined 使用同一模型，MCP 契约不变。
#### Scenario: 兼容的完整 JSON
- **WHEN** 用户运行默认 --json
- **THEN** 输出 comparison v1 完整报告，不再输出旧 total/manual/auto 等字段；迁移文档说明不兼容性与字段替换，limit 不截断报告
#### Scenario: 无副作用的报告组装
- **WHEN** 新报告交给表格或 Markdown 渲染器
- **THEN** 渲染器不采集、不重算或修改输入，使用报告自己的时间与时区
