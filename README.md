# agent-usage

在本机统计 Codex 的 Skill、MCP 和 Hook 使用证据，无需 API Key、数据库或常驻服务。Skill 记录表示指定、注入或文件读取信号，不代表执行成功。

## 快速开始

需要 Node.js `^22.18.0 || >=24.11.0` 和 pnpm。已在 Windows 验证，其他平台尚未实测。以下命令在项目根目录执行。

```powershell
pnpm install --frozen-lockfile
pnpm run build
node ./dist/index.mjs setup
node ./dist/index.mjs --days 30
```

`setup` 为当前使用者生成本机映射。新增技能或插件后运行 `node ./dist/index.mjs skills refresh`。项目内技能可用 `skills refresh --project-root E:/your-project` 纳入，目录设置会保留。

初始化和双来源统计按 `--codex-dir`、`CODEX_HOME`、`~/.codex` 的优先级选择数据目录。每个使用者维护自己的配置。

## 启用 Hook 采集

```powershell
node ./dist/index.mjs hooks install
```

审查安装的采集器及启动文件，在 Codex 中启用 Hooks，并通过 `/hooks` 信任 **PreToolUse / Bash**。安装保留其他钩子并备份配置；采集仅覆盖启用后留存的记录。

## 常用统计

| 内容 | 命令 |
| --- | --- |
| 最近 30 天日志 | `node ./dist/index.mjs --skill-method logs --days 30` |
| 最近 30 天 Hook | `node ./dist/index.mjs --skill-method hooks --days 30` |
| 两来源合并去重 | `node ./dist/index.mjs --skill-method combined --days 30 --limit 0` |
| MCP 调用 | `node ./dist/index.mjs --mcp --days 30` |
| 默认合并统计 | `node ./dist/index.mjs --days 30` |
| 全部本机技能出处 | `node ./dist/index.mjs --provenance` |
| 离线 Hook 处理器统计 | `node ./dist/index.mjs --hooks --days 30` |

双来源表格固定显示 **Skill、Logs Explicit、Logs Inferred、Hooks、Unique Total、Last Recorded**。按同实例、会话、轮次、技能去重；同轮同技能计一次，`Unique Total` 是选中来源的并集。

默认统计身份完整的证据，另列未决数量，不表示完整使用总量。加 `--skill-counts strict` 使用严格口径：受未决影响的计数显示 `—`。未选择来源的列也显示 `—`，已知零显示 `0`。

## 参数与导出

| 参数 | 用途 |
| --- | --- |
| `--days N` | 最近 N×24 小时；省略则查看全部历史 |
| `--limit N` | 表格最多 N 行，默认 25；0 表示全部，不影响汇总或 JSON |
| `--codex-dir PATH` | 指定 Codex 数据目录 |
| `--json --output PATH` | 保存完整 UTF-8 JSON，会覆盖同名文件 |
| `--skill-evidence PATH` | 重放证据包，默认 combined |
| `--help` | 查看完整参数 |

```powershell
node ./dist/index.mjs --skill-method combined --days 30 --json --output .local/skill-stats.json
node ./dist/index.mjs --skill-method combined --days 30 --markdown --output .local/skill-stats.md
```

出处查询遍历本机映射中的全部技能，核对当前文件与元数据，不读取使用日志，也不接受 `--days`。Skill 查询默认 `combined`；表格、JSON 和 Markdown 均使用同一新口径。

旧 `--strict` 已移除；`--skill-counts strict` 控制未决证据的严格计数，不表示排除推断。`--hooks` 读取离线处理器通知，`--skill-method hooks` 读取技能采集证据。详细参数及组合限制见帮助和下列文档。

## 排障与文档

- 配置缺失：运行 `setup`；映射缺失：运行 `skills refresh`，必要时指定项目或自定义技能根。
- Hook 没有记录：检查数据目录、Codex 启用与信任状态，以及是否发生受支持的技能读取。
- 找不到 `dist/index.mjs`：在根目录运行 `pnpm run build`；修改源码后也需重新构建。
- 分享 JSON 前检查本机信息。统计只读取支持的记录，不能证明历史完整或技能执行成功。

| 文档 | 内容 |
| --- | --- |
| [Skill 双来源统计](docs/skill-comparison.md) | 初始化、映射、去重与统计口径 |
| [结构化整理指令](docs/skill-evidence-extraction.md) | Codex 或人工整理证据 |
| [Skill Hook 验证](docs/skill-hook-validation.md) | 真实验证与故障记录 |
| [MCP 统计](docs/mcp-statistics.md) | 输入结构与诊断 |
| [离线 Hook 统计](docs/hooks-statistics.md) | 处理器通知导入协议 |
| [Skill 来源资料](docs/skill-provenance.md) | 元数据与来源候选 |
| [公共契约](docs/usage-contract.md) | JSON 与源码接口 |
| [Markdown 报告](docs/markdown-report.md) | 新 Skill 统计报告导出 |
| [维护卡](MAINTENANCE.md) | 更新、检查与恢复 |
| [验收归档](openspec/changes/archive/2026-11-02-add-skill-collection-comparison/implementation-verification.md) | 实施和验证记录 |
