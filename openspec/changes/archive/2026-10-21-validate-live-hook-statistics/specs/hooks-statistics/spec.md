## ADDED Requirements

### Requirement: 真实执行验证证据
手工链路验证 SHALL 区分真实 Codex Hook 执行与合成样本，且 SHALL 保留正常信任边界。

#### Scenario: 真实同步 Hook 捕获并导入
- **WHEN** 已审查的测试命令 Hook 写入执行标记，Codex 发出匹配的原生生命周期通知
- **THEN** 离线导入报告使用已核实并声明的原生时间单位统计真实执行
- **AND** 验证记录包含标记、通知数、聚合结果和覆盖限制
