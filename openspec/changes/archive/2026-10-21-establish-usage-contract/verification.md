# Verification — 2026-10-20

## 基线与提交范围
- 初始 Skill CLI 首次提交：060098b86622f86959c7cbfb3e92326cdebd81cd，保留原 codex/skill-statistics 分支，从该提交建立 main。
- 首次提交前复核核心测试 57/57、CLI 集成测试 26/26、类型检查与原 change 严格校验均通过。暂存差异检查发现三处末尾空行，按约定暂停；用户明确授权“清理后继续”后仅清理这三处，差异检查通过再提交。
- 初始白名单为 25 个源码、锁文件、配置与文档；真实 JSONL、handoff、依赖及构建输出保持忽略。对候选文本和契约暂存文件检查了私钥头、常见 GitHub/OpenAI/AWS 凭据特征，未发现匹配；该检查不构成无敏感数据的保证。
- 本轮在 main 形成契约提交，其 HEAD 是后续并行工作的共同基线；完整 SHA 由交付消息报告，可运行 git rev-parse main 查询。未创建两个功能分支或 worktree。

## 本轮检查
- pnpm run test：60/60 通过，包括 57 项原核心测试、3 项契约运行测试；TypeScript 同时检查 4 项 @ts-expect-error 类型负例。
- pnpm run typecheck：通过。
- pnpm run test:cli：构建通过，26/26 集成测试通过；强化 JSON 版本、strict、时区、旧嵌套字段和总计断言，原帮助、版本、limit、窗口、表格和非法参数测试保持通过。
- openspec validate add-skill-statistics --strict --no-interactive：通过。
- openspec validate establish-usage-contract --strict --no-interactive：通过。
- git diff --cached --check：通过；Git 忽略规则复查通过。
- src/aggregate.ts 仅变更类型位置及重导出，未修改聚合算法；src/types.ts、采集器、静态读取解析、表格及锁文件未改变。无新增依赖。

## 子 Agent 审查
使用一个 contract_review 子 Agent 只读对照初始提交审查源码、测试入口、OpenSpec 与契约文档；未发现阻止提交的可操作问题。审查确认旧类型导入、CLI 参数和统计口径保持兼容，MCP 身份与未知结果口径清楚。子 Agent 未修改文件或运行构建/测试，实际检查由主 Agent 执行。

## 兼容与环境边界
- CLI JSON 增加 schemaVersion、strict、timeZone；原字段不变。允许附加字段的读取器兼容，拒绝未知键的外部校验器需要调整。
- MCP 只提供内部 TypeScript 契约，无运行时验证、采集或聚合实现；Markdown 渲染也尚未实现。报告组装复用输入 totals/skills 引用，消费方按只读使用。
- 测试只使用合成数据，没有扫描真实 Codex 会话或调用外部 MCP 服务。
- 环境：Windows、Node v22.22.2、pnpm 9.15.0、OpenSpec 1.13.0。未声称完成 Node 20 或 POSIX 主机验证。
- 普通沙盒在命令启动前仍报 setup refresh/helper_unknown_error，命令经批准通道执行；未修改系统 ACL 或沙盒配置。
- 未推送、发布或自动归档；两个 OpenSpec change 均保留在 changes 下。原来源与许可证边界仍见 README。
