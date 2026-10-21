## ADDED Requirements

### Requirement: Node 支持范围与构建前提一致
项目 SHALL 在 engines.node 中声明 ^22.18.0 || >=24.11.0，并使用 node22.18 作为构建目标，使源码安装、构建与运行前提符合当前锁定依赖的 Node 要求。

#### Scenario: 当前版本声明
- **WHEN** 维护者查看包配置、构建配置及当前使用说明
- **THEN** engines.node 为 ^22.18.0 || >=24.11.0，构建目标为 node22.18
- **AND** README 和维护卡说明 Node 22.18.0 至 22.x 或 Node >=24.11.0 的要求，不再声明支持 Node 20

### Requirement: 验证范围明确
项目 SHALL 区分依赖约束推导的支持范围与实际执行验证的 Node 环境。

#### Scenario: 单版本本地验证
- **WHEN** 仅在 Windows / Node 22.22.2 执行检查
- **THEN** 记录类型检查、模块测试、构建和 CLI 测试结果
- **AND** 不将其他 Node 版本或平台描述为已实测通过
