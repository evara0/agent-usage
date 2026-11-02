# Context

本地基线为 39090d109710156e6039419ad7b2f118d7f5d53f，worktree 分支 codex/skill-markdown-report 干净。该新分支无 upstream，检查技能要求不得擅自设置跟踪或把缓存远端当同步证明。用户在父聊天明确授权两个变更本次基于本地 39090d1 跳过远端同步，因此以“明确跳过”继续；未 fetch、pull 或 push，未宣称与远端同步。

# Goals / Non-Goals

- 与新 JSON/表格消费同一完整 SkillComparisonReport，避免重复采集与再聚合。
- 六列统一，时间使用报告声明时区，未选来源与严格未知保持 —，零保持 0。
- 明确退出旧 Markdown，而非静默改变原命令的统计含义。
- 不移除整个旧统计链，不迁移出处清单功能，不合并或推送。

# Decisions

renderMarkdown 改为只接收 SkillComparisonReport，调用同一 displaySkillTime 并按上游排名呈现全部技能；不使用旧 auto/manual/inferredAuto、filesScanned 或扫描耗时。未决只汇总当前模式和窗口，且不泄露原始路径、命令或候选正文。名称及文本转义 Markdown/HTML。

新参数组合 --skill-method ... --markdown 与 JSON 互斥；旧 --markdown 没有 method 时在扫描前给出可执行迁移形式，旧 --strict 继续只用于旧统计，不映射到新严格策略。新策略使用 --skill-counts strict。

# Risks / Trade-offs

源码级 renderMarkdown 参数类型与旧裸 Markdown 命令有兼容变化，必须更新文档和依赖测试。--provenance --markdown 不再有效，出处独立清单由另一工作树承担。新输出只保证已支持的证据信号，不证明成功或完整历史。

# Validation

模块测试核对三种视图、同模型计数、策略与未决范围、时区、转义、纯函数和全量行。CLI 测试核对 JSON/Markdown 一致、重放、limit、UTF-8 导出覆盖和写入失败、旧入口在读取前拒绝；运行全套回归、typecheck 和 OpenSpec 严格校验。
