# Spec Delta

## MODIFIED Requirements

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
