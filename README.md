# agent-usage

首个模块：本地 Codex Skill 统计命令行。读取 sessions、archived_sessions、history.jsonl；不执行日志中的代码。

## 安装与运行

需要 Node >=20 和 pnpm。在项目目录执行：

```powershell
pnpm install --offline --frozen-lockfile # 本地缓存完整时；否则去掉 --offline
pnpm run build
node ./dist/index.mjs --days 30 --limit 0
node ./dist/index.mjs --days 30 --strict
node ./dist/index.mjs --codex-dir C:/Users/wangz/.codex --json
```

打包声明 agent-usage 和 skillusage 两个可执行入口；本轮仅本地开发，没有全局安装或发布。

| 参数 | 含义 |
| --- | --- |
| --days N / -d N | 滚动最近 N×24 小时，正有限数；默认全部历史 |
| --limit N / -l N | 表格行数，非负整数；默认25，0全部，不限制JSON |
| --strict | 排除全部推断读取 |
| --json | stdout 输出完整 JSON，无横幅 |
| --codex-dir PATH | 指定 Codex home，默认 ~/.codex |
| --help / -h | 帮助 |
| --version / -v | 版本 |

没有 Claude 来源、daily 子命令、趋势图或子 Agent 筛选。未知参数/位置参数报错。

## 统计口径

表格 Total 为聚合后的记录数；Explicit = total - inferredAuto（含手动 $skill 与明确注入）；Inferred 为静态 SKILL.md 读取推断；Last recorded 为最新保留事件的 ISO 时间。记录不能证明 Skill 执行成功，也不能用于成功率或准确召回率。

明确事件按 session/skill/秒去重；推断每 session/skill 最多一次，保留范围内有明确事件即抑制推断。history 与 rollout 手动信号120秒合并，注入回声300秒抑制。注入重放按跨 session 的 skill/秒合并，可能合并独立会话同秒记录。名称归一化保留 aliases。

JSON 包含 generatedAt、source: codex、windowDays、filesScanned、elapsedMs、totals 和完整 skills。每项保留 manual、auto、inferredAuto、sources、daily、projects、aliases、lastUsedAt；daily 按运行机器本地日期。filesScanned 是候选 rollout 文件数加 history 路径，即使 history 不存在也加1，不是成功读取数。损坏行跳过。动态参数、任意 shell、here-document 不保证识别；不支持可靠区分子 Agent。

JSON 另含 schemaVersion: 1、strict 和 timeZone，原字段保持原类型与口径；读取器应允许附加字段。公共类型位于 src/contracts.ts，报告由 src/report.ts 组装。MCP 仅定义类型，尚未采集；Markdown 报告尚未实现。契约与后续分工见 [公共契约](docs/usage-contract.md)。

## 开发与验证

```powershell
pnpm run test
pnpm run typecheck
pnpm run test:cli # 包含构建
openspec validate add-skill-statistics --strict --no-interactive
openspec validate establish-usage-contract --strict --no-interactive
```

测试只使用临时合成日志，包含核心、报告契约、MCP 类型负例和 CLI 回归。handoff、真实JSONL、node_modules、dist、.test-dist 均被Git忽略。OpenSpec变更位于 openspec/changes/add-skill-statistics 与 establish-usage-contract，均未归档。本地 main 以首次提交 060098b 建立；后续并行功能应从公共契约验收后的最终提交启动。

## 来源

Codex采集、静态解析、归一化、聚合与核心测试迁自本机 G:/skillusage 的当前工作副本（含未提交Windows/custom解析修复），上游为 [lovstudio/skillusage](https://github.com/lovstudio/skillusage)，基线 HEAD 99f7c5f。源包声明 MIT，迁移快照未包含独立 LICENSE 文件，不能据此补造版权归属。本项目保留来源说明；未发布。CLI和表格为本项目精简实现。维护步骤见 [MAINTENANCE.md](MAINTENANCE.md)。
