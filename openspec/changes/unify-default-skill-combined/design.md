## Context
项目已有 SkillComparisonReport 及 logs/hooks/combined 适配器，旧默认链路与其并存。

## Goals / Non-Goals
统一默认及显式 Skill 输出；不改新去重算法、不增加采集范围，不修改独立 MCP/Hook/出处协议。

## Decisions
以模式标记判定独立功能，其余请求进入 SkillComparisonReport，method 缺省 combined。不设置全局 method 默认值，避免与 MCP 等参数误冲突。仅在 Skill 模式允许 skill-evidence、skill-counts。--strict 保留为报错哨兵并提示新策略语义，不将其自动翻译。JSON 继续沿用已发布 comparison v1，以 kind 区分已移除的旧报告。

## Risks / Trade-offs
默认 JSON 和源码接口不兼容；文档明确字段替换与 kind 判别。缺少 setup 配置时明确失败，不回退旧统计。

## Migration Plan
更新调用方使用 comparison 字段；重建 dist。用户个人安装入口另行维护，本次不重装采集器。

## Validation
合成证据核对默认与显式 combined 的 JSON/表格/Markdown 一致性、跨来源重算、strict/resolved、窗口和输出限制；全模块和 CLI 回归确保独立模式不变。
