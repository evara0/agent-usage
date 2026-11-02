# 验证记录

日期：2026-11-02；基线 39090d109710156e6039419ad7b2f118d7f5d53f；工作树 codex/skill-markdown-report。

## Git 前置检查

工作区初始干净，新分支没有 upstream。遵循 openspec-git-preflight 未擅自设置跟踪关系，也未把缓存 origin/main 当作远端同步证明。用户在父聊天明确选择“基于本地39090d1执行”，覆盖两个 worktree 的本次新变更，故记录为明确跳过远端同步。未 fetch/pull/push。

## 实施结果

- renderMarkdown 改收 SkillComparisonReport，与新 JSON/表格共用上游采集、重放、窗口、策略和技能轮次去重。
- 统一六列、报告声明时区的 YYYY-MM-DD HH:mm、模式和计数策略；resolved/strict、选中来源/窗口的未决提示、未知和零保持区分。
- --skill-method logs|hooks|combined --markdown 支持完整导出；limit 不截断。旧裸 --markdown 及旧 strict/provenance Markdown 在输入读取前拒绝并提示迁移。
- 保留旧非 Markdown 表格和 JSON，以及 MCP/离线 Hook 行为。渲染器无旧 SkillUsageReport、collectCodexEvents、旧 aggregate 或 provenance 渲染依赖。

## 检查结果

- pnpm install --offline --frozen-lockfile：因缓存缺少 cli-table3 tarball 未完成；随后 pnpm install --frozen-lockfile 正常下载固定锁定依赖，未修改 lockfile。
- pnpm run test：171 项模块测试通过。
- pnpm run typecheck：通过。
- pnpm run test:cli：80 项通过。
- openspec validate --all --strict --no-interactive：11 项通过。
- openspec validate --archived --strict --no-interactive：11 项通过。
- git diff --check：通过。

新增或更新的测试核对三种模式与新 JSON 的同一计数、2/3/4/6 组合、strict/resolved 未决、窗口和来源隔离、冻结输入不变、文本转义、时区转换、30 行不截断、中文路径 UTF-8 无 BOM、覆盖写入与失败无 stdout，以及旧命令/冲突参数不读取缺失输入、不创建输出。

## 兼容与集成

源码级 renderMarkdown 的参数类型有明确兼容变化；旧 SkillUsageReport 仅保留用于旧 JSON。新 Markdown 不与出处查询组合。

出处解耦分支将共同修改 src/index.ts、tests/provenance-cli.test.mjs、docs/skill-provenance.md、README/维护说明和 CLI 集成规范；合并时需保留其独立出处路由及本变更的 Markdown 新路由和互斥规则，不能把出处用量重新拼入新报告。主工作目录未提交的 README 精简未被覆盖。本分支未合并、推送、归档或移除工作树。
