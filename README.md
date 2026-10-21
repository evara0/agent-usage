# agent-usage

本地 Codex 使用证据统计 CLI：查看 Skill 频次、MCP 调用，以及离线导入的 Hook 结果和耗时。统计在本机完成，不执行日志中的代码，无需 API Key、数据库或常驻服务。

> Skill 记录不代表执行成功或任务质量；MCP、Hook 仅在有明确结果证据时判定成功或失败。

## 快速开始

需要 **Node.js 22.18.0 至 22.x，或 24.11.0 及以上版本**，以及 **pnpm**。已在 Windows / Node 22.22.2 验证，其他版本和平台尚未实测。

在项目根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm run build
node ./dist/index.mjs --days 30
```

默认读取 `~/.codex`，展示最近 30 天使用记录最多的前 25 个 Skill。省略 `--days` 统计全部历史，`--limit 0` 展示全部行。修改源码后需重新构建。

## 选择统计内容

| 内容 | 命令 | 输出与边界 |
| --- | --- | --- |
| Skill | `node ./dist/index.mjs --days 30` | 排名、明确/推断记录、最近记录时间 |
| Skill 当前来源 | `node ./dist/index.mjs --provenance` | 当前来源候选及文件/用户声明，不追溯历史作者 |
| MCP | `node ./dist/index.mjs --mcp --days 30` | 按服务端/工具分组的调用、结果、可靠耗时样本 |
| 离线 Hook | `node ./dist/index.mjs --hooks --days 30` | 已导入同步通知的调用、结果、可靠耗时样本；不安装采集器 |

Skill 表格中 `Total` 为去重后的记录数，`Explicit = Total − Inferred`。`Inferred` 来自受支持的静态 `SKILL.md` 读取；加 `--strict` 可排除这些推断。

MCP/Hook 的 `Calls = Succeeded + Failed + Unknown`。Unknown 表示证据不足；耗时均值仅使用可靠样本，无样本显示 `-`，观测零耗时显示 `0.00`。

## 参数

| 参数 | 说明 |
| --- | --- |
| `--days N` / `-d N` | 最近 N×24 小时，支持正有限小数；默认全部历史 |
| `--limit N` / `-l N` | 表格行数上限，默认 25；非负整数，0 表示全部 |
| `--codex-dir PATH` | Codex 数据根目录，默认 `~/.codex` |
| `--strict` | Skill 专用，仅保留明确记录 |
| `--json` | 完整 JSON，无 CLI 横幅 |
| `--markdown` | 完整 Skill Markdown 报告 |
| `--output PATH` | 配合 JSON/Markdown 写无 BOM UTF-8 文件，创建父目录并覆盖同名文件 |
| `--mcp` / `--hooks` | 选择 MCP 或离线 Hook 模式，二者互斥 |
| `--provenance` | 为 Skill 追加当前来源资料 |
| `--skill-root PATH` | 来源模式的 standalone 根，默认所选 Codex 目录下的 skills |
| `--plugin-root PATH` | 来源模式的一个完整插件版本目录；默认不扫描插件缓存 |
| `--provenance-map PATH` | 来源模式的 version=1 JSON 用户声明，扫描日志前校验 |
| `--help` / `-h` | 查看帮助 |
| `--version` / `-v` | 查看版本 |

`--json` 与 `--markdown` 互斥。`--strict`、`--markdown`、`--provenance` 仅用于 Skill；三个来源路径参数必须配合 `--provenance`。未知参数、非法数值及不兼容组合会在读取输入前报错。

`--limit` 只截断表格，不改变汇总、JSON 或 Markdown 内容。

## 常用操作

以下命令均在项目根目录执行；路径中有空格时加引号。

```powershell
# 最近 7 天，仅明确记录，展示前 10 个 Skill
node ./dist/index.mjs -d 7 -l 10 --strict

# 指定 Codex 数据目录
node ./dist/index.mjs --codex-dir "D:/Codex Data/.codex" --days 30

# 保存完整 Skill 报告
node ./dist/index.mjs --days 30 --markdown --output .local/skill-usage.md

# 保存 MCP JSON；Hook 使用 --hooks
node ./dist/index.mjs --mcp --json --output .local/mcp-usage.json

# 使用用户声明补充当前来源
node ./dist/index.mjs --provenance --provenance-map .local/skill-provenance-map.json --json

# 在 PowerShell 中读取 Skill JSON
$report = node ./dist/index.mjs --days 30 --json | ConvertFrom-Json
$report.skills | Select-Object skill, total, inferredAuto, lastUsedAt
```

推荐用 `--output` 保存中文报告，避免 shell 管道转码。成功写文件时 stdout 为空，失败时返回非零退出码。JSON 含项目目录等本机信息，分享前请检查。

## 数据与统计边界

| 模式 | 读取内容 |
| --- | --- |
| Skill | `sessions/**/*.jsonl`、`archived_sessions/**/*.jsonl`、`history.jsonl` |
| MCP | 两个会话目录中的 JSONL，不读 history |
| Hook | `usage-hooks/**/*.jsonl`；本工具的离线导入约定，非 Codex 原生目录 |
| 来源资料 | 当前 Skill 元数据、显式指定的单插件版本及可选用户映射 |

- 时间窗口按滚动 N×24 小时计算；Skill 的每日计数使用运行机器的本地日期。
- Skill 明确记录按会话/Skill/秒去重；推断每会话每 Skill 最多一次，存在明确记录时抑制推断。手动信号按 120 秒合并、附近 300 秒注入视为回声；跨会话同秒注入可能被合并。
- 静态读取仅识别部分 Windows/POSIX 命令；动态表达式及任意 shell 写法不保证覆盖，不能可靠区分子 Agent。
- Skill 的 `filesScanned` 为候选会话数加 history 路径，不代表成功读取数。MCP/Hook 的 `scan` 覆盖整次扫描，也不代表日志完整率。
- MCP 主要通过合成样本验证；没有独立调用记录的代码封装可能无法统计。Hook 已有一次真实同步链路验证，尚无持续采集、完整持久历史或异步覆盖。
- 来源资料只提供当前候选；E3 文件声明、U 用户声明及目录名称均不等于官方或原创认证。

## 排障与详细说明

| 情况 | 先检查 |
| --- | --- |
| 统计为空或偏少 | `--codex-dir` 是否为数据根目录；去掉 `--days`、`--strict` 对照 |
| MCP Unknown 较多 | `scan`、支持的输入结构及结果是否有明确证据 |
| Hook 为空 | 是否导入通知、首行协议和单位、`coverage` 与 `scan`；空结果不证明未运行 |
| 来源 unknown/ambiguous/conflict | 元数据诊断、别名、候选身份及用户映射 |
| 找不到 `dist/index.mjs` | 在根目录运行 `pnpm run build` |
| 保存中文乱码 | 使用相同选项加 `--output` 重新导出 |

| 文档 | 内容 |
| --- | --- |
| [维护卡](MAINTENANCE.md) | 更新、检查、排障与保留数据 |
| [公共契约](docs/usage-contract.md) | JSON 字段和源码接口 |
| [Markdown 报告](docs/markdown-report.md) | 报告格式、转义和文件输出 |
| [MCP 统计](docs/mcp-statistics.md) | 支持的日志结构及扫描质量字段 |
| [Hook 统计](docs/hooks-statistics.md) | 离线输入协议、覆盖范围和诊断 |
| [Hook 验证记录](docs/live-hook-validation.md) | 单次真实同步链路的验证证据 |
| [Skill 来源资料](docs/skill-provenance.md) | 元数据、用户映射及关联规则 |
