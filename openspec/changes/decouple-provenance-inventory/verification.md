# 验证记录

日期：2026-11-02。分支 codex/skill-provenance-inventory，基线 39090d1；用户明确授权本次跳过同步，未设置 upstream、未推送。

## 实现与验证

- --provenance 独立读取全部本机映射，包括从未使用、缺失、只有名称和多路径的条目，不读取 sessions/history。
- 每个路径保留摘要、存在性和独立元数据；链接不跟随，不枚举未映射兄弟技能。
- 文件/用户声明并列，精确 skillKey 关联，不认证官方或历史出处；输出独立 v2 清单而非旧用量报告。
- 174 项模块测试通过，保留旧默认统计及低层声明兼容回归。
- 72 项 CLI 测试全部通过，包含 8 项新版出处清单测试，无跳过；Windows junction 链接边界和目录大小写已覆盖。
- typecheck、OpenSpec 全部严格校验和 git diff --check 通过。

## 兼容与集成

--provenance --days/--strict/--markdown 不再合法；旧查询根参数提示先用 skills refresh 更新本机映射。JSON 调用方从独立 skills 读取，不再从用量报告的 provenance.inventory/associations 读取。--output 仅配 JSON，limit 不截断 JSON。

旧 collectSkillProvenance 和 v1 低层渲染暂保留以免扩大移除范围，但其输入改为结构化 skill/aliases，不导入 SkillStats。新 CLI 完全不调用这些兼容入口。另一个 Markdown 分支也修改 src/index.ts、README、维护卡和公共契约文档，后续集成需统一分派与互斥规则。

本变更不归档、不合并、不推送；用户主目录未提交的 README 精简没有复制或覆盖。测试输出位于忽略目录 .local/。
