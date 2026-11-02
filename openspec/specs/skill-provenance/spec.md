# skill-provenance Specification

## Purpose

通过显式开关，为 Skill 使用统计提供离线、有界、只读的当前来源候选与用户声明；区分发行方、原作者、获取途径、许可和本地状态，保持历史归属与未知边界。

## Requirements

### Requirement: Offline current provenance
系统 SHALL 通过 --provenance 读取所选 Codex home 的 usage-skills/config.json，列出全部映射技能并逐路径核实普通文件存在性，读取当前离线出处资料。查询 MUST 只读，不读取使用日志、不依赖旧统计结果，不跟随链接，不输出原始本机路径或凭据。
#### Scenario: 未使用和历史路径
- **WHEN** 映射包含从未使用、已删除或多个实际文件的技能
- **THEN** 全部条目都出现在报告，存在性与多路径歧义明确区分，映射登记本身不证明安装
#### Scenario: 不可用日志
- **WHEN** sessions/history 不存在、损坏或不是可读日志
- **THEN** 不影响出处清单，出处查询不打开这些路径
#### Scenario: Missing metadata
- **WHEN** 映射文件缺失、不可读、不支持或没有归属声明
- **THEN** 存在性单独表示，元数据字段保持 unknown，诊断可见，不从目录或 .system 认证官方或原创
#### Scenario: Plugin publisher
- **WHEN** 相邻插件清单声明 author、license
- **THEN** 只形成文件声明的发行方和许可证候选，不推导技能原作者或许可证适用性

### Requirement: Explicit user declarations
系统 SHALL 接受 version=1 的显式出处声明并整体校验，拒绝未知键、类型、枚举、超限和重复 selector。声明 SHALL 仅按精确 skillKey 应用到本机映射条目；用户值标记 U，与文件值并列，不一致保留 conflict，不按别名合并技能。
#### Scenario: Invalid mapping
- **WHEN** 出处声明格式无效
- **THEN** 在读取映射技能文件前非零退出，不回显正文或凭据，不写输出文件
#### Scenario: Registered reference
- **WHEN** 用户声明只有 registered 身份，没有本机技能映射登记或安装文件
- **THEN** 未登记的身份不创建清单条目；已登记但无路径显示 unmapped，不能声称安装或使用过

### Requirement: Identity and historical boundary
系统 SHALL 按映射 skillKey 标识条目，按精确路径形成当前候选；多个存在路径 SHALL 明确 ambiguous。文件与用户声明保持来源和冲突，不将当前声明回填历史事件或认证官方身份。
#### Scenario: 同名不同技能
- **WHEN** 两个不同 skillKey 具有相同显示名称
- **THEN** 保持两个清单条目，不通过短名合并
#### Scenario: 多路径
- **WHEN** 同一 skillKey 有两个不同的存在文件
- **THEN** 分别保留候选及路径摘要，不静默选择一个
#### Scenario: Same name or version ambiguity
- **WHEN** 同名条目具有不同 skillKey，或同一身份有多个存在文件
- **THEN** 不按短名合并，不静默选择某一版本或路径
#### Scenario: Historical event
- **WHEN** 使用者查询当前出处
- **THEN** 报告标记 current_reference_only，不读取历史事件，也不据当前声明重算历史次数

### Requirement: Optional report compatibility
--provenance SHALL 输出独立 schemaVersion=2、kind=skill-provenance-inventory 报告，包含全部映射条目、当前观察时间和诊断。表格 limit 仅限制展示，JSON 导出完整。
#### Scenario: 无关参数
- **WHEN** --provenance 与 --days、--strict、--markdown、--skill-method、MCP 或 Hook 用量模式混用
- **THEN** 读取文件前拒绝，并说明出处不依赖使用记录；旧扫描根参数提示改用 skills refresh 配置发现范围
#### Scenario: 原有统计
- **WHEN** 用户不指定 --provenance
- **THEN** 此变更不改变旧默认统计、新 Skill 对比、MCP 或 Hook 统计
#### Scenario: Complete export
- **WHEN** --provenance 与 --json --output 合用
- **THEN** 输出完整独立清单，不受表格 limit 截断，UTF-8 正确并标明声明不是核验
#### Scenario: Invalid option combination
- **WHEN** 出处声明映射未配 --provenance，或出处与使用统计及旧扫描根参数混用
- **THEN** 在读取配置与元数据前拒绝，默认模式不扫描元数据
