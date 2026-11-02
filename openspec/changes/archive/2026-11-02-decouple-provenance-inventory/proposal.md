# Why

当前 --provenance 先读取使用日志再关联出处，只覆盖使用过的技能，无法作为本机全部技能的出处清单。用户要求以本机技能映射为入口，解除旧使用统计依赖。

# What Changes

- --provenance 输出独立的映射技能出处清单，逐路径核实存在性并读取当前元数据。
- 所有映射条目均保留，区分存在、缺失、未映射、不可判定和多路径歧义，不按使用量或时间筛选。
- 保留文件/用户声明和冲突语义；不将声明视为官方认证，不把当前元数据当作历史归属。
- --days、--strict、--markdown 和旧出处扫描根参数与出处清单互斥；目录更新通过 setup/skills refresh 显式完成。

# Impact

出处 JSON 从旧用量报告的附加字段迁移为独立 schemaVersion=2、kind=skill-provenance-inventory 报告。旧默认 Skill 统计及其 Markdown 实现不在本变更移除范围。

# Git Preflight

2026-11-02 用户明确授权本次在 codex/skill-provenance-inventory 基于本地 39090d1 跳过远端同步。工作树干净、无 upstream；未改跟踪配置、未拉取、未推送。该明确跳过仅适用于当前工作树和本变更。
