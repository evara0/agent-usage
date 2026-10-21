---
title: "agent-usage · 项目维护卡"
project: "agent-usage"
updated: "2026-10-21"
status: "Windows / Node 22.22.2 回归通过；单次同步 Hook 链路已验证"
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

需要 Node **22.18.0 至 22.x，或 >=24.11.0**（`^22.18.0 || >=24.11.0`）及 pnpm；构建目标为 `node22.18`。已验证 Windows / Node 22.22.2，其他版本和平台尚未实测。

在 `G:/agent-usage` 执行：

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

构建会替换 `dist/`，模块测试生成 `.test-dist/`；二者均可重建。`.local/`、`handoff/`、原始日志、个人映射不进入 Git；包清单只包含 `dist`。无远端部署或自动更新流程。

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
