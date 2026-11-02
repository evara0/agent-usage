## MODIFIED Requirements
### Requirement: 独立模式在统一入口兼容共存
CLI SHALL 保持默认 Skills、可选 Skills 来源、MCP 和 Hooks 的边界，通过 --skill-method logs|hooks|combined 提供新 Skill 对比表格、JSON 或 Markdown。所有不兼容参数 MUST 在读取前拒绝；旧 --hooks 仍表示处理器统计，默认 Skill 使用 combined，新旧表格和 JSON 不再并存；默认模式允许 skill-evidence、skill-counts。

#### Scenario: 来源增强与 Hooks 混用
- **WHEN** 用户同时提供 --hooks 与 --provenance 或其专用路径参数
- **THEN** 读取前返回参数错误且不写输出文件

#### Scenario: 各功能独立使用
- **WHEN** 用户分别使用合法的来源、MCP 或 Hooks 命令
- **THEN** 保留对应口径与输出契约，统一测试入口覆盖原有功能与新 Markdown

#### Scenario: 三种 Skill 对比模式
- **WHEN** 指定 --skill-method logs、hooks 或 combined
- **THEN** 使用 skill-usage-comparison 输出表格、JSON 或显式 --markdown，支持 days、limit、codex-dir、skill-counts 与 output
- **AND** limit 仅截断表格，不截断 JSON 或 Markdown

#### Scenario: 结构化证据文件
- **WHEN** --skill-evidence PATH 与新 mode 和 Markdown 合用
- **THEN** 仅重放该包并按新模型重算，不扫描额外个人日志、不执行输入或改写原始数据

#### Scenario: 新旧参数互斥
- **WHEN** 新模式与 --mcp、--hooks、--provenance、旧 --strict 或来源专用参数混用，或 Markdown 与 JSON 混用
- **THEN** 读取前拒绝，stdout 为空且不写文件
- **AND** 裸 --markdown 使用默认 combined；显式模式 --markdown 同样合法

#### Scenario: 原始结构化报告可重放
- **WHEN** 同一新报告按相同 mode、period、countPolicy 重放为 JSON 或 Markdown
- **THEN** 证据、计数与最近时间一致，不把生成时间或重复导入视为新使用记录

