<h1 align="center">agent-usage</h1>

<p align="center">
  <strong>在本机统计 Codex Skills 使用证据</strong><br>
  无需 API Key · 不联网 · 不上传
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square"></a>
  <a href="package.json"><img alt="Node: ^22.18 || >=24.11" src="https://img.shields.io/badge/node-%5E22.18%20%7C%7C%20%3E%3D24.11-339933?style=flat-square&logo=nodedotjs&logoColor=white"></a>
  <img alt="Platform: Windows" src="https://img.shields.io/badge/platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white">
  <img alt="Runtime dependencies: 0" src="https://img.shields.io/badge/runtime%20deps-0-brightgreen?style=flat-square">
</p>

<p align="center"><a href="README.md">English</a> | 简体中文</p>

---

## 项目定位

| 功能 | 状态 |
| --- | --- |
| Skills 统计（当前重点） | Logs + Hook 两路采集，默认合并去重 |
| [MCP 统计](docs/mcp-statistics.md) | 未完整开发，真实链路未验证 |
| [Hooks 执行统计](docs/hooks-statistics.md) | 未完整开发，仅支持离线导入 |

`hooks install` 和 Skills 表格的 **Hooks** 列用于采集、展示技能证据；`--hooks` 才统计 Hook 本身的执行。

## 快速开始

需要 Node.js `^22.18.0 || >=24.11.0` 和 pnpm，在项目根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm run build
node ./dist/index.mjs setup
node ./dist/index.mjs --days 30
```

示例输出（合成数据，加 `--skill-evidence docs/examples/skill-comparison-combined.json` 可复现）：

```text
Date: 2026-10-28    Mode: Logs + Hooks    Counts Resolved evidence

│ Skill   │ Logs Explicit │ Logs Inferred │ Hooks │ Unique Total │ Last Recorded    │
│ handoff │             2 │             3 │     4 │            6 │ 2026-10-28 18:35 │

6 skill-turns · 1 skill
```

## 常用命令

| 目的 | 命令 |
| --- | --- |
| 默认（日志 + Hook 合并去重） | `--days 30` |
| Skills：只看 Logs / 只看 Hook 采集证据 | `--skill-method logs` / `--skill-method hooks` |
| 技能出处与许可证 | `--provenance` |
| 导出 JSON / Markdown | `--json --output a.json` / `--markdown --output a.md` |
| 新增技能或插件后刷新映射 | `skills refresh` |
| 安装 Skills 实时采集器（通过 Hook） | `hooks install` |

以上命令均在 `node ./dist/index.mjs` 之后追加；完整参数见 `--help`。

## 读数须知

- Skills 表格中，**Logs Explicit**：明确的指定或注入；**Logs Inferred**：只读到 `SKILL.md`（弱证据）；**Hooks**：通过 Hook 采集的技能证据，不是 Hook 执行次数。
- 三者都不代表技能执行成功；`Unique Total` 按实例 + 会话 + 轮次 + 技能去重。
- 未决（unresolved）单独计数、不进默认结果；`--skill-counts strict` 会把受未决影响的计数显示为 `—`。

## 注意

- 插件更新后运行 `skills refresh`，否则新版本的读取会落入未映射。
- Skills 的 Hook 采集需在 Codex 中启用，并通过 `/hooks` 信任 PreToolUse / Bash；只覆盖启用后的记录。
- JSON / Markdown 可能含技能名与路径摘要，分享前检查。目前仅 Windows 实测。

文档见 [docs/](docs/)，维护见 [MAINTENANCE.md](MAINTENANCE.md)，许可见 [LICENSE](LICENSE)。采集器部分衍生自 [skillusage](https://github.com/lovstudio/skillusage)（MIT），来源与许可边界见 [NOTICE](NOTICE)。
