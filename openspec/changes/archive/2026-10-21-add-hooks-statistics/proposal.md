## Why

现有 CLI 只统计 Skill 和 MCP，无法查看 Hook 执行证据。本机调查没有找到可靠的持久执行记录；配置、安装、启用和会话存在都不能代替执行证据。需要独立且保守的离线导入功能，并明确空结果的覆盖缺口。

## What Changes

- 新增 Hook 最小记录、只读离线 App Server 通知导入、关联去重、聚合及质量计数。
- 新增 `--hooks` 表格/JSON，复用窗口、行数、数据目录与直接 UTF-8 输出；扫描前拒绝模式冲突。
- 文档记录官方来源、本机版本调查范围、离线导入协议与未覆盖部分。

## Capabilities

### New Capabilities
- `hooks-statistics`: 基于明确 Hook 生命周期证据的离线统计与覆盖说明。

### Modified Capabilities

无。Skill/MCP 公共契约及既有语义保持不变。

## Impact

仅新增 Hook 专属模块和测试，并修改授权入口、测试脚本及使用/维护文档。不新增依赖，不部署采集器、不修改 Codex 配置、不连接 App Server、不运行 Hook、不启用遥测。需要持续持久采集时另行授权。
