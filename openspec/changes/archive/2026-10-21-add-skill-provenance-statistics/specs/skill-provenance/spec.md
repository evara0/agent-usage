## ADDED Requirements

### Requirement: Offline current provenance
系统 SHALL 通过显式 --provenance 只读收集当前本地资料，默认不联网、不执行元数据、不修改安装。系统 SHALL 有界读取所选 skills 根和可选单一插件版本根，不跟随符号链接，不输出原始路径、仓库凭据或作者邮箱。
#### Scenario: Missing metadata
- **WHEN** 文件缺失、不可读、不支持或没有归属声明
- **THEN** 对应字段保持 unknown，诊断计数可见，不从目录、名称或 .system 认证官方或原创
#### Scenario: Plugin publisher
- **WHEN** 插件清单声明 author、license
- **THEN** 只形成 E3 发行方和许可证声明，不推导 Skill 原作者或开源许可适用性

### Requirement: Explicit user declarations
系统 SHALL 接受 version=1 的显式 JSON 映射并进行整体运行时校验，未知键、类型、枚举、超限和重复 selector SHALL 拒绝。用户声明 SHALL 标记 U，与文件声明保留并列；不一致 SHALL 标记 conflict。
#### Scenario: Invalid mapping
- **WHEN** 映射无效
- **THEN** CLI 在扫描使用日志前非零退出，错误不回显输入正文或路径
#### Scenario: Registered reference
- **WHEN** registered 身份只有用户注册没有安装证据
- **THEN** 显示其 user_registered 类型，不声称已经安装或历史使用该实例

### Requirement: Identity and historical boundary
系统 SHALL 根据原始别名和完整插件命名空间产生当前候选关联，多候选或部分未解析别名 SHALL 明确为 ambiguous；系统 SHALL NOT 将当前安装作者无依据回填历史事件或按作者重算历史次数。
#### Scenario: Same name or version ambiguity
- **WHEN** 名称命中多个身份或聚合别名不能唯一确定同一身份
- **THEN** 列出候选身份及未解析别名，不静默按短名称选择
#### Scenario: Historical event
- **WHEN** 历史使用记录与当前资料关联
- **THEN** 报告标记 current_reference_only，关联最多为 candidate，原计数不变

### Requirement: Optional report compatibility
系统 SHALL 仅在启用时为 Skill JSON 增补独立 provenance 字段并在表格和 Markdown 展示；现有 source=codex、schemaVersion、计数、去重、默认 JSON/MCP/Markdown 与直接 UTF-8 导出行为 SHALL 保持兼容。
#### Scenario: Complete export
- **WHEN** --provenance 与 JSON/Markdown 或 --output 合用
- **THEN** 来源资料完整输出、不受表格 limit 截断、UTF-8 正确，且说明声明证据和历史限制
#### Scenario: Invalid option combination
- **WHEN** provenance 输入缺少 --provenance 或与 --mcp 组合
- **THEN** 扫描日志前拒绝，默认模式不扫描元数据
