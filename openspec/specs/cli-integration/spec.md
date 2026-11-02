# cli-integration Specification

## Purpose
约束 Skills、可选来源、MCP 与 Hooks 在统一 CLI 中兼容共存，确保非法组合在读取输入前拒绝，并区分自动化回归和单次真实验证的覆盖范围。

## Requirements

### Requirement: 独立模式在统一入口兼容共存

CLI SHALL 保持默认 Skills、可选 Skills 来源、MCP 和 Hooks 的边界，并通过显式 --skill-method logs|hooks|combined 提供新 Skill 对比模式；所有不兼容参数 MUST 在读取输入前拒绝。旧 --hooks 继续表示 Hook 处理器统计，新模式不得静默修改既有 Skill 表格、去重或 SkillUsageReport v1。

#### Scenario: 来源增强与 Hooks 混用
- **WHEN** 用户同时提供 --hooks 与 --provenance 或其专用路径参数
- **THEN** CLI 在读取使用日志或来源映射前返回明确参数错误
- **AND** 不写输出文件

#### Scenario: 各功能独立使用
- **WHEN** 用户分别运行合法的 Skills 来源、MCP 或 Hooks 命令
- **THEN** CLI 保留对应统计口径与输出契约
- **AND** 统一测试入口包含全部原有和新功能测试

#### Scenario: 三种 Skill 对比模式
- **WHEN** 用户显式指定 --skill-method logs、hooks 或 combined
- **THEN** CLI 使用 skill-usage-comparison 契约输出对应英文表格或完整 JSON
- **AND** 支持 days、limit、codex-dir、json 和 output，其中 limit 只影响表格
- **AND** 新增 --skill-counts resolved|strict，日常本机查询默认 resolved；该参数仅用于 --skill-method，非法值在读取前拒绝

#### Scenario: 结构化证据文件
- **WHEN** 用户通过 --skill-evidence PATH 提供已保存的结构化 Skill 证据文件
- **THEN** 参数必须与 --skill-method 合用，输入校验和重算遵守 skill-evidence 规范
- **AND** 不执行输入中的代码、不启动采集器、不改写原始日志

#### Scenario: 新旧参数互斥
- **WHEN** --skill-method 与 --mcp、--hooks、--provenance、其专用路径参数、--strict 或 --markdown 合用，或 method 不受支持
- **THEN** 在读取任何输入前返回参数错误且不写输出文件
- **AND** 未指定 --skill-method 的合法旧命令保持原行为

#### Scenario: 原始结构化报告可重放
- **WHEN** 用户以 --json --output 导出对比报告，再将该文件作为 --skill-evidence 输入
- **THEN** 同模式同窗口可重算一致的证据、计数和最近时间，generatedAt 等运行元信息除外
- **AND** 不把重复导入或生成时间当作新的技能使用

### Requirement: 总控验收具有明确证据范围
总控 SHALL 区分分支测试、合并后回归和单次真实 Hook 执行证据。

#### Scenario: 使用已有真实通知验收
- **WHEN** 合并后 CLI 读取已验证的同步 Hook 通知
- **THEN** 得到一致的调用、结果和耗时
- **AND** 文档不将单次离线验证描述为完整历史或持续采集覆盖

### Requirement: 每个使用者独立初始化与更新映射

CLI SHALL 提供 setup 和 skills refresh，按 --codex-dir、CODEX_HOME、~/.codex 的优先级选择数据实例，扫描自己的标准技能目录与插件缓存，支持重复显式 skill-root、plugin-root 和 project-root。首次初始化 MUST 生成并保留本机实例 ID；刷新 MUST 保留人工配置、既有路径身份和历史映射，不依赖开发者的个人配置或忽略目录脚本。

#### Scenario: 全新用户启动日志统计
- **WHEN** 使用者在自己的全新目录运行 setup 后查询 --skill-method logs
- **THEN** CLI 从该目录生成并读取本机映射，身份完整的实际日志可产生确定的 resolved 统计
- **AND** 配置缺失时给出 setup 指引，坏配置不被覆盖，旧配置写入前备份且原子替换

#### Scenario: 显式项目范围与刷新
- **WHEN** 使用者提供 project-root 或自定义技能/插件根并在以后执行 skills refresh
- **THEN** 范围保存在 usage-skills/settings/discovery.json，后续刷新继续使用，不向旧 config.json 添加不兼容字段
- **AND** 不扫描无关项目，不跟随链接；多版本或人工歧义保持待核对，删除文件不自动删除历史映射

### Requirement: 显式可移植的 Hook 注册

CLI SHALL 提供 hooks install，在用户选择的数据实例固定安装构建后的采集器并更新用户级 hooks.json，保留无关处理器与配置备份。安装 MUST 不修改信任状态；统计查询不隐式注册 Hook。

#### Scenario: Windows 路径与正常信任
- **WHEN** 用户从包含空格、中文或单引号的目录安装本采集器
- **THEN** 生成的启动器按原始字节转发 stdin，采集器可留存同实例结构化证据，采集失败不阻断工具
- **AND** 用户仍须在 Codex 正常审查信任并启用 Hooks；安装不会绕过信任或修改执行策略
