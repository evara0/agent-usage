---
title: "agent-usage · 项目维护卡"
project: "agent-usage"
updated: "2026-10-21"
status: "本地源码与合成测试核验；无远端部署"
environments:
  - "Windows 本地 Node.js"
---

# agent-usage · 项目维护卡

修改源码后构建，再重新运行命令。项目统计本地 Codex Skill 与 MCP 记录。

## 项目是什么

TypeScript / Node ESM CLI；入口 src/index.ts，Skill 采集与静态解析在 src/adapters/，聚合 src/aggregate.ts，表格 src/render/table.ts。公共类型在 src/contracts.ts，报告组装在 src/report.ts；MCP 采集在 src/adapters/mcp.ts、聚合在 src/mcp-aggregate.ts、表格在 src/render/mcp-table.ts。没有前端、服务、数据库或监听端口。数据来自用户Codex目录，仅只读扫描。依赖由 package.json 与 pnpm-lock.yaml 管理，tsdown构建，node:test验证。

## 本地怎么运行

在 G:/agent-usage：`pnpm install --frozen-lockfile`，`pnpm run build`，`node ./dist/index.mjs --days 30`。缓存齐全可安装时加 --offline。需要Node >=20；当前Windows验证不代表已经覆盖所有Node版本和POSIX平台。

程序单次运行后退出；中断用Ctrl+C，再次执行即重新扫描。使用 --codex-dir 指定数据目录。无常驻进程，无需重启服务。

使用 `node ./dist/index.mjs --days 30 --markdown` 输出完整 Skill Markdown 报告；与 --json 互斥，--limit 不截断报告。渲染器在 src/render/markdown.ts，输出与保存用法见 README。

保存 Markdown/JSON 时追加 `--output .local/skill-usage.md`（JSON 使用对应文件名），由 src/output.ts 直接写无 BOM UTF-8，自动创建父目录并覆盖目标文件；仅文件输出时 stdout 为空。不要依赖 shell 管道转码保存中文。已出现乱码的报告保留或备份后，用相同选项重新生成；原始日志不受影响。

使用 `node ./dist/index.mjs --mcp --days 30` 查看 MCP 表格，添加 --json 输出完整 MCP 报告。--mcp 与 --strict/--markdown 互斥；默认仍为 Skill 统计。MCP 不访问外部服务或启用遥测。

## 改什么，怎么生效

改 src/ 后执行测试、类型检查与 test:cli（包含构建）；依赖变更用pnpm更新唯一锁文件。改README/OpenSpec无需构建。日志内容不进入Git或包；handoff仅本地保留，不自动同步。包的files仅包含dist。

公共契约与并行修改边界见 [docs/usage-contract.md](docs/usage-contract.md)。新增测试须接入 package.json 的检查入口；不要在同一 worktree 同时运行会覆盖相同生成目录的构建或测试。当前正式规范在 openspec/specs，完成变更在 openspec/changes/archive；新需求先创建对应 change。使用 `openspec validate --all --strict --no-interactive` 和 `openspec validate --archived --strict --no-interactive` 校验，归档与推送仅按用户明确授权执行。

## 程序更新到本地

`pnpm run test`、`pnpm run typecheck`、`pnpm run test:cli`，然后重新运行dist/index.mjs。构建清理并替换dist，测试输出在.test-dist；不会改动Codex数据。无远端部署、自动更新或发布流程。

## 出问题先做什么

JSON应可整体解析；空统计先检查 --codex-dir、--days 和 --strict。检查stderr错误信息与退出码。损坏JSONL行会跳过，filesScanned不代表成功读取数。JSON 的 schemaVersion 为 1，读取器应允许附加字段。保留handoff和原始Codex数据；首次提交 060098b 是原 Skill CLI 回滚基线，使用 git log 查看后续契约提交。不得使用清理命令删除原始日志。统计限制与来源见README。

MCP 空结果或 Unknown 较多时，先检查报告 scan 中的目录、读取、损坏行及身份计数，再核对 [MCP 覆盖范围](docs/mcp-statistics.md)。scan 是整次扫描的计数；MCP filesScanned 不含 history 路径，与 Skill 模式口径不同。无耗时样本不等于零耗时。
