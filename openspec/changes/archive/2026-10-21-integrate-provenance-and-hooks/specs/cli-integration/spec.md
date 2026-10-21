## ADDED Requirements

### Requirement: 独立模式在统一入口兼容共存
CLI SHALL 保持默认 Skills、可选 Skills 来源、MCP 和 Hooks 的边界，且在读取输入前拒绝不兼容参数。

#### Scenario: 来源增强与 Hooks 混用
- **WHEN** 用户同时提供 --hooks 与 --provenance 或其专用路径参数
- **THEN** CLI 在读取使用日志或来源映射前返回明确参数错误
- **AND** 不写输出文件

#### Scenario: 各功能独立使用
- **WHEN** 用户分别运行合法的 Skills 来源、MCP 或 Hooks 命令
- **THEN** CLI 保留对应统计口径与输出契约
- **AND** 统一测试入口包含全部原有和新功能测试

### Requirement: 总控验收具有明确证据范围
总控 SHALL 区分分支测试、合并后回归和单次真实 Hook 执行证据。

#### Scenario: 使用已有真实通知验收
- **WHEN** 合并后 CLI 读取已验证的同步 Hook 通知
- **THEN** 得到一致的调用、结果和耗时
- **AND** 文档不将单次离线验证描述为完整历史或持续采集覆盖
