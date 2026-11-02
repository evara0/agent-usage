## MODIFIED Requirements
### Requirement: 总控 CLI 输出接线
CLI SHALL 通过 --skill-method logs|hooks|combined --markdown 输出新口径完整报告，支持 skill-evidence、skill-counts、days、codex-dir 和 output。Markdown MUST 无横幅且不受 limit 截断。裸 --markdown SHALL 使用默认 combined；旧 --strict 以及 provenance Markdown MUST 在读取前拒绝；旧 Skill 表格/JSON 链路移除。

#### Scenario: 完整文档输出
- **WHEN** 使用者指定新 method、--markdown 以及可选窗口、策略、证据包和输出路径
- **THEN** 与新 JSON 使用同一采集和重算模型，输出完整六列表格并保留 UTF-8 文件与错误行为

#### Scenario: 输出冲突
- **WHEN** 使用 --markdown 与 --json、旧 --strict、--provenance 混用
- **THEN** 扫描前非零退出，stdout 为空，输出文件不创建，stderr 说明迁移或互斥原因
