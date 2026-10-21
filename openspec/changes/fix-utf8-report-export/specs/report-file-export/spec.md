## ADDED Requirements

### Requirement: 直接 UTF-8 导出
CLI SHALL 提供 --output PATH 配合 --markdown 或 --json，将完整报告直接写入无 BOM UTF-8 文件，创建缺失的父目录，覆盖指定的已有文件，且不输出横幅或正文到 stdout。

#### Scenario: 中文 Markdown 与路径
- **WHEN** 用户导出到包含中文和空格的路径
- **THEN** 文件中的中文与渲染文本一致，以换行结束，不经过 shell 的字节解码

#### Scenario: JSON 导出
- **WHEN** 用户使用 --json --output，包括 --mcp --json --output
- **THEN** 文件可按 UTF-8 读取和解析，原有数据字段与口径不变

### Requirement: 输出错误与兼容
CLI SHALL 保持未指定 --output 时的原有 stdout 行为；仅表格模式的文件输出请求在扫描前拒绝，写入失败使用 stderr 并非零退出。

#### Scenario: 模式不适用
- **WHEN** 使用 --output 但没有 --json 或 --markdown
- **THEN** 在扫描前报错，stdout 为空

#### Scenario: 文件写入失败
- **WHEN** 指定目标为目录或发生文件系统写入错误
- **THEN** stderr 解释失败且退出码非零，stdout 为空，不修改源日志
