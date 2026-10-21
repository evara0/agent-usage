# Verification

## Environment
- 验证日期：2026-10-20（Asia/Shanghai）。
- 工作目录：C:\Users\wangz\.codex\worktrees\36c1\agent-usage。
- 分支：codex/markdown-report。
- 起始 HEAD：938cb0c278802973fcbf3de60b81f86563c9079b，与总控指定的 main 基线一致。
- Node.js v22.22.2；依赖由 pnpm install --frozen-lockfile --offline 安装，54 个包全部复用缓存，零下载。
- Git worktree 分支操作和 Corepack 缓存访问使用产品批准通道；未改系统 ACL、全局配置、原 checkout 或另一功能 worktree。

## Checks
所有构建和测试顺序执行，仅使用合成数据；未扫描真实 Codex 日志。

| 命令 | 结果 |
| --- | --- |
| pnpm run typecheck | 通过 |
| pnpm run test | 60/60 通过，含核心、契约与编译期类型负例 |
| pnpm exec tsc -p tsconfig.test.json | 通过，显式编译 Markdown 测试 |
| node --test .test-dist/tests/markdown.test.js | 6/6 通过 |
| pnpm run test:cli | 构建通过，26/26 CLI 合成回归通过 |
| openspec validate add-markdown-report --strict --no-interactive | 通过 |
| git diff --check / git diff --cached --check | 通过 |

Markdown 测试验证混合证据的明确/推断口径、完整上下文、小数滚动窗口、strict 与全部历史、空统计、null 时间、排序、冻结输入和确定性、HTML/Markdown/实体/换行/控制字符转义，以及 30 行和长名称不截断。故意不一致的 strict 与时间窗口输入验证渲染器不会替上游重新筛选。

## Delivery
- 唯一导出接口：src/render/markdown.ts 的 renderMarkdown(report: SkillUsageReport): string。
- 按契约读取完整报告，不重新采集或聚合事件；概览只从已有字段计算明确/推断展示值。
- 字符实体由 Markdown 阅读器显示为原字符；时间冒号在 Markdown 源文本中为 &#58;，不作时间或时区转换。管道表格需阅读器支持。
- 本地提交限定为模块、新测试、模块文档及本 change；不合并 main、不推送、发布、归档或删除 worktree。
- 总控仍需完成 CLI 参数接线与行为测试、将新测试加入 package.json、README 使用说明；tasks 第 4 节保持待办。公共契约不需调整。

## 总控集成验收 — 2026-10-20
- 总控在原功能 worktree 独立重跑类型检查、60 项原有测试、6 项报告测试、26 项 CLI 测试及严格规范校验，全部通过；确认工作区干净且修改范围符合分工后，将 f5c3e39 合并至本地 main。
- 已接入 --markdown，与 --json 互斥且预检在扫描前拒绝冲突；输出以报告标题开始，不含横幅，--limit 不截断报告。默认表格与原 JSON 字段不变。
- main 的 pnpm run test 为 66/66，通过编译期类型负例；pnpm run typecheck 通过；pnpm run test:cli 构建通过、29/29，通过新增完整报告、strict、空数据和冲突回归；OpenSpec 严格校验和差异检查通过。
- 已更新统一测试入口、README、报告文档及维护卡。仅使用合成数据，未扫描真实日志；功能 worktree 保留，不推送、不归档。

## 联合集成复验 — 2026-10-21
- 与 MCP 模块合并后，统一模块测试 112/112、CLI 集成测试 38/38、类型检查及四个 change 严格校验均通过。Skill Markdown 的完整输出、strict、窗口、空数据、参数互斥以及与 MCP 日志共存的行为继续通过。
- --markdown 保持 Skill 专用；与 --mcp 组合在扫描前拒绝。没有更改 Markdown 渲染器或公共 Skill 报告类型。
