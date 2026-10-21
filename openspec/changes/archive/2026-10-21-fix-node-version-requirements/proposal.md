## Why

项目声明 Node >=20，构建目标为 node20，但当前锁定的 gunshi 要求 Node >=22，tsdown 要求 ^22.18.0 || >=24.0.0，其 Babel 依赖要求 ^22.18.0 || >=24.11.0。现有声明不能准确指导源码安装、构建与运行。

## What Changes

- 将项目 Node 支持范围统一为当前锁定依赖要求的交集：^22.18.0 || >=24.11.0。
- 将构建目标提升至 Node 22.18，并同步 README 与维护卡。
- 验证配置一致性、现有模块测试、类型检查、构建及 CLI 回归，记录实际环境和未覆盖版本。

## Capabilities

### New Capabilities
- `node-runtime-support`: 约束项目声明、构建目标及当前使用说明的 Node 版本一致性。

## Impact

修改 package.json、tsdown.config.ts、README.md 与 MAINTENANCE.md；不升级依赖，不改变统计口径，不修改历史归档，不自动归档本变更。
