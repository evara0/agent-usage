---
title: "agent-usage · 项目维护卡"
project: "agent-usage"
updated: "2026-10-30"
status: "Windows / Node 24.14.0；真实 Skill Hook 采集与日志同轮去重已验证"
environments:
  - "Windows 本地 Node.js"
---

# agent-usage · 项目维护卡

修改源码后执行检查与构建，再运行 CLI。项目只读统计本地 Codex Skill、MCP 和离线 Hook 使用证据。

## 项目是什么

TypeScript / Node ESM CLI，pnpm 管理依赖，tsdown 构建，node:test 测试。没有前端、数据库、常驻服务或监听端口。

| 路径 | 用途 |
| --- | --- |
| `src/index.ts` | CLI 参数与模式分派 |
| `src/adapters/` | 日志采集、静态读取解析 |
| `src/*aggregate.ts` | 各模式聚合 |
| `src/render/` | 表格与 Markdown |
| `src/contracts.ts`、`src/*types.ts`、`src/report.ts` | 契约、类型与报告组装 |
| `src/provenance.ts` | 当前来源资料 |
| `tests/` | 模块及 CLI 回归 |

## 本地运行

需要 Node **22.18.0 至 22.x，或 >=24.11.0**（`^22.18.0 || >=24.11.0`）及 pnpm；构建目标为 `node22.18`。已验证 Windows / Node 22.22.2 与 24.14.0，其他平台尚未实测。

在当前仓库根目录执行；本次工作树为 `E:/261027-agent_usage-tool/worktrees/skill-collection-contract`：

```powershell
pnpm install --frozen-lockfile
pnpm run build
node ./dist/index.mjs --days 30
```

依赖缓存完整时可安装加 `--offline`。默认读 `~/.codex`，用 `--codex-dir` 切换；命令结束即退出，中断用 Ctrl+C。各模式、参数和导出示例见 [README](README.md)。

## 修改与本地更新

源码变更后，在项目根目录顺序执行：

```powershell
pnpm run test
pnpm run typecheck
pnpm run test:cli
```

`test` 编译并执行模块测试及类型负例；`test:cli` 构建后执行全部 CLI 回归。成功后重新运行 `dist/index.mjs`。不要同时运行会覆盖相同生成目录的检查。

依赖变更更新 `package.json` 和唯一锁文件；新增测试须接入检查入口。纯文档修改无需构建或应用测试。

构建会替换 `dist/`，模块测试生成 `.test-dist/`；二者均可重建。`.local/`、`handoff/`、原始日志、个人映射不进入 Git；包清单包含 `dist`、`schemas` 和 `scripts/skill-hook-launcher.mjs`。无远端部署或自动更新流程。

## 规范与历史记录

当前要求见 [openspec/specs](openspec/specs/)，历史交付见[归档](openspec/changes/archive/)。功能、配置和接口变更先建对应 change，归档与推送按明确授权执行。

```powershell
openspec validate --all --strict --no-interactive
openspec validate --archived --strict --no-interactive
```

接口见[公共契约](docs/usage-contract.md)，运行约束及验证结果见[Node 要求修复记录](openspec/changes/archive/2026-10-21-fix-node-version-requirements/verification.md)。

## 排障与恢复

先检查 stderr 和退出码，再按 [README 排障表](README.md#排障与详细说明)核对输入目录、窗口及模式诊断。保存报告优先用 `--output`，直接写无 BOM UTF-8；它会覆盖指定目标。

来源歧义查 `provenance.diagnostics` 与映射，去掉 `--provenance` 可恢复普通统计。Hook 查首行单位、`scan`、`coverage`；程序不会安装或运行 Hook。

保留原始 Codex 数据、个人映射及交接资料。代码可从 Git 历史恢复后重新构建，已有乱码报告可重新导出；不要通过改写或删除日志修正统计。

真实 Hook 证据位于 `.local/worktree-recovery/2026-10-21/hooks/`，只在本机保留。离线重放及单次样本的覆盖范围见[验证记录](docs/live-hook-validation.md)；重新执行实时验证可能调用模型。

## Skill 对比新增维护点

--skill-method 为可选新模式，旧默认与 --hooks 处理器统计不变。Schema 随包发布在 schemas/；采集命令为 dist/skill-hook-entry.mjs。

保留 usage-skills 中的 config.json、证据包及未决项；不要通过修改原始日志修正汇总。只读重放见 docs/skill-comparison.md。2026-10-30 本机正常信任后，真实 PreToolUse / Bash 已生成证据包；两次同轮读取与日志精确归组后得到 0/1/1/1，重复导入不增计。该结论限于实测路径，不代表完整覆盖。

用户级 Hook 配置在 Codex home 的 hooks.json；停止或启用使用 /hooks，修改定义后须正常重新信任。当前安装使用固定工具目录，不依赖 worktree 的 dist。可选诊断入口仅保留 usage-skills/diagnostics/latest.json，记录阶段和字段形状，不参与统计。PowerShell 启动问题、回退和验收证据见 [Skill Hook 验证](docs/skill-hook-validation.md)。新增技能或插件版本后须显式更新技能映射，否则进入未决，不能直接当作零使用。
