# 验证记录

## Environment

- 日期：2026-10-20（Asia/Shanghai）。
- 独立工作目录：C:\Users\wangz\.codex\worktrees\f187\agent-usage。
- 分支：codex/mcp-statistics。
- 起始 HEAD：938cb0c278802973fcbf3de60b81f86563c9079b，与指定 main 基线一致。
- Node.js v22.22.2，pnpm 10.28.1，OpenSpec 1.13.0。
- pnpm install --frozen-lockfile --offline：54 个包均复用缓存，未修改依赖清单或锁文件。

## Validation

| 检查 | 结果 |
| --- | --- |
| node node_modules/typescript/bin/tsc -p tsconfig.test.json --outDir .local/mcp-test-dist | 通过，成功后才运行新测试 |
| node --test --test-reporter=spec .local/mcp-test-dist/tests/mcp.test.js | 43/43 通过 |
| pnpm run typecheck | 通过 |
| pnpm run test | 60/60 通过，包含核心、契约及类型负例编译 |
| pnpm run test:cli | 构建通过，26/26 CLI 合成测试通过 |
| openspec validate add-mcp-statistics --strict --no-interactive | 通过 |
| git diff --check 与暂存差异检查 | 通过，无空白错误；全部新增文件纳入暂存检查 |

测试和构建顺序执行。新测试使用 .local/mcp-test-dist，与既有 .test-dist 和 CLI dist 分开，不与其他 worktree 共用生成目录。所有数据测试使用临时合成日志，未读取真实会话、调用外部 MCP 服务、修改 Codex 配置或启用遥测。

首次新测试编译发现辅助函数 inv 参数被测试样本推断为过窄类型；已按约定暂停并报告。用户明确授权修复后，仅将测试辅助函数输入改为 unknown，未削弱公共契约或移除负例。上述表格为修复后重新编译及完整验证的结果。最初编译失败时产生的运行结果不作为验收依据。

## Coverage

合成测试覆盖空数据、缺失目录、损坏行、缺失/冲突 session 元信息、直接 function/custom MCP 调用、生命周期调用、明确成功/失败、结果缺失/文本/缺失标志、取消/阻断/超时/传输错误、同身份重复/重放、乱序、跨当前及归档文件关联、同 callId 不同会话、同秒独立调用、孤立结果、调用/结果元信息冲突、时间校验、观测零耗时/缺失耗时/非法耗时/冲突耗时、聚合计数不变量、联合身份分隔符碰撞、稳定排序、滚动窗口边界、输入不变性、运行时非法契约和耗时求和溢出。

扫描失败分支提供计数，但没有制造 Windows ACL 故障；非目录扫描根的合成错误已覆盖。只对文档列出的受控信号结构作出通过声明，未对真实 Codex 版本作兼容性认证。普通 JSONL 未保留显式 isError 时，结果仍为 unknown；无法识别的嵌套 MCP 调用未计入。完整限制和字段口径见 docs/mcp-statistics.md。

## Change Boundary

仅新增 src/adapters/mcp.ts、src/mcp-aggregate.ts、tests/mcp.test.ts、docs/mcp-statistics.md 和本 change 下的规划/验证文件。公共契约、入口、报告组装、Skill 采集聚合、package.json、锁文件、README、MAINTENANCE 和其他 change 未修改。

Git 切换、暂存与提交只更新当前功能 worktree 对应的 Git 管理元数据及功能分支；未修改 G:\agent-usage 的工作文件或另一个功能 worktree。没有合并 main、推送、发布、归档或删除 worktree。

## Handoff

源码接口：collectMcpEvents(codexDir?: string): Promise<McpScanResult>；aggregateMcpEvents(records: McpCallRecord[], opts?: McpAggregateOptions): McpAggregateResult，选项为 days?: number。公共输出复用既有 McpCallRecord 与 McpAggregateResult，未绕过契约。

模块实现无已知阻塞问题。总控仍需完成 CLI/表格接线、报告上下文与扫描异常展示、package.json 的新测试运行接入、主 README 更新及最终集成验收。第 4 组任务保持未勾选，change 不自动归档。

## 总控集成验收 — 2026-10-21

- 模块提交 227280190706743da8b81f8840ec2e62164f0bad，功能 worktree 干净、修改范围符合分工。总控独立重跑 43 项 MCP 测试、60 项原核心/契约测试、26 项 CLI 测试、类型检查及 OpenSpec 严格校验全部通过后，在 Markdown 已验收接线的 main 上合并。
- 已接入 --mcp 选择 MCP 表格或 --json，复用 --days、--codex-dir 和表格 --limit；与 --strict/--markdown 冲突时预检在扫描前拒绝。默认 Skill 表格、既有 Skill JSON 与 Markdown 保持兼容。
- MCP JSON 使用 kind: mcp 的独立信封，保留完整 tools 和 scan 质量计数，不输出原始事件、参数或结果正文。表格暴露成功/失败/未知与可靠样本均值，无耗时样本为 -，观测零值为 0.00；扫描计数覆盖全部输入，不代表覆盖率。
- 首轮集成检查为模块测试 112/112、类型检查通过、CLI 37/38；新增目录错误场景把根路径设为普通文件，本机返回的错误分类不同于断言预期。按用户约定暂停并报告，得到“允许”后仅改为正常根目录内 sessions 是普通文件、archived_sessions 是目录的明确错误场景；未修改采集器或公共契约。
- 修正后 pnpm run test：112/112；pnpm run typecheck：通过；pnpm run test:cli：构建通过，38/38。新入口实际包含 57 项 Skill 核心、3 项契约、6 项 Markdown、43 项 MCP、3 项 MCP 表格测试；CLI 包含原 26 项及新增 12 项集成回归。编译期契约负例继续检查。
- 四个 change（add-skill-statistics、establish-usage-contract、add-markdown-report、add-mcp-statistics）严格校验全部通过；差异格式检查通过。README、MCP 文档、公共契约说明和维护卡已同步到已实现行为。
- 全部功能验收仅使用合成数据，不读取真实 Codex 日志或调用外部 MCP 服务。环境仍为 Windows、Node v22.22.2；不声称跨平台或真实 Codex 版本完整兼容。
- 总控仅在本地 main 提交集成；两个功能分支及 worktree 保留，未推送、发布、自动归档或删除 worktree。
