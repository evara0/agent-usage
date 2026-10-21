# CLI Skill 统计模块

## Why
agent-usage 的首个模块需要统计本地 Codex Skill 记录，复用旧项目已修复的解析和回归资产。

## What Changes
- 建立 Git 与 OpenSpec，忽略 handoff、日志、依赖与生成输出；不提交、不推送。
- 提供 Codex 排名、时间筛选、strict、证据表格与完整 JSON。
- 保留 Windows/custom 静态解析、手动信号和原有去重。
- 排除 Claude、daily 子命令、趋势图、服务和自动任务。

## Capabilities
### New Capabilities
- `skill-statistics`: 本地 Codex Skill 记录统计。

## Impact
新增 Node ESM/TypeScript CLI、pnpm 锁文件、测试与维护说明。旧项目只读。
