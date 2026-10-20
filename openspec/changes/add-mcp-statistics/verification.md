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
