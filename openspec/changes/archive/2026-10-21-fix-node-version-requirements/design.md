## Context

项目当前从源码构建交付，使用相同的 Node 要求指导开发、构建与运行。实际可用环境为 Windows / Node 22.22.2；node_modules 与锁文件已存在。

## Goals / Non-Goals

目标是消除 Node 20 的错误支持声明，并让当前配置和文档遵循锁定依赖要求。非目标是降低依赖版本、增加多版本运行环境、引入 CI 或调整包管理器配置。

## Decisions

1. engines.node 使用 ^22.18.0 || >=24.11.0，覆盖 Node 22 的受支持小版本及 Node 24.11 以上版本；不承诺 Node 23 或 Node 24.0–24.10。
2. tsdown target 使用 node22.18，明确编译产物的最低语法目标。构建目标本身不代表所有声明版本均已实测。
3. README 和维护卡同时说明支持范围、依赖依据及实际验证环境。历史 OpenSpec 及验收记录保持原样。
4. 不新增镜像配置值的应用测试；使用一次性配置断言及现有测试入口验证。若 pnpm 被 Corepack 联网限制阻断，通过本地 tsc、tsdown 和 node --test 执行等价命令，明确记录差异。

## Risks / Trade-offs

这是有意收紧 Node 支持范围；Node 20 用户需升级。当前仅有 Node 22.22.2，最低版本和 Node 24 分支不能标记为实测通过。锁文件无需更新，因为依赖清单及版本未变。

## Validation

核对支持范围与锁定依赖、构建目标和两份说明的一致性；执行类型检查、151 项模块回归、构建和 65 项 CLI 回归，以及 OpenSpec 严格校验和 git diff --check。
