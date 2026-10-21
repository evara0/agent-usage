# agent-usage

在终端查看本地 **Codex Skill 与 MCP 使用记录**：了解 Skill 的使用频次与证据类型，或查看 MCP 工具调用、明确结果和可用耗时样本。

统计在本机完成，只读扫描 Codex 日志，不执行日志中的代码。无需 API Key、数据库或常驻服务。

## 功能

- 按使用记录数展示 Skill 排名和最近记录时间。
- 按最近 N 天筛选，支持仅统计明确记录。
- 自动合并重复信号，保留 Skill 名称别名。
- 输出终端表格、完整 JSON 或 Markdown 报告；JSON 同时包含按日期、项目目录划分的计数。
- 支持指定 Codex 数据目录，读取当前及已归档的会话日志。
- 使用 `--mcp` 查看按服务端和工具划分的调用统计，区分成功、失败、未知，并展示扫描质量计数。
- 使用 `--provenance` 查看当前 Skill 来源候选，分开发行方、原作者、获取途径、许可和本地改写声明；缺证据保留 unknown。

> 统计反映日志中的使用证据，不代表 Skill 成功执行次数或任务完成质量。

## 快速开始

需要 **Node.js 20 或更高版本**和 **pnpm**。已在 Windows + Node.js 22 环境验证。

当前从源码构建运行。在项目根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm run build
node ./dist/index.mjs --days 30
```

最后一条命令读取当前用户的 `~/.codex`，展示最近 30 天记录数最多的前 25 个 Skill。省略 `--days` 时统计全部可用历史。

终端输出示意，以下名称和数字均为虚构：

```text
Skill           Total  Explicit  Inferred  Last recorded
example-skill      12         9         3  2026-10-20T07:30:00.000Z
another-skill       5         5         0  2026-10-19T09:00:00.000Z

17 records · 14 explicit / 3 inferred · 2 skills · last 30d · source: codex
```

后续修改源码后，重新执行 `pnpm run build` 即可运行更新后的版本。若本地依赖缓存完整，可在安装命令中添加 `--offline`。

## 常用命令

以下命令均在项目根目录运行。

```powershell
# 查看全部历史，展示所有 Skill
node ./dist/index.mjs --limit 0

# 最近 7 天，只展示前 10 个 Skill
node ./dist/index.mjs -d 7 -l 10

# 最近 30 天，排除静态读取推断
node ./dist/index.mjs --days 30 --strict

# 指定 Codex 数据目录；路径中有空格时加引号
node ./dist/index.mjs --codex-dir "D:/Codex Data/.codex" --days 30

# 输出完整 JSON
node ./dist/index.mjs --days 30 --json

# 输出完整 Markdown 使用报告
node ./dist/index.mjs --days 30 --markdown

# 直接保存 UTF-8 Markdown 文件，避免 shell 管道转码
node ./dist/index.mjs --days 30 --markdown --output .local/skill-usage.md

# 查看最近 30 天的 MCP 工具调用
node ./dist/index.mjs --mcp --days 30

# 输出完整 MCP JSON
node ./dist/index.mjs --mcp --days 30 --json

# 查看帮助和版本
node ./dist/index.mjs --help
node ./dist/index.mjs --version
```

### 参数

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--days N` / `-d N` | 最近 N×24 小时；N 为正有限数，支持小数 | 全部历史 |
| `--limit N` / `-l N` | 表格最多展示 N 行；N 为非负整数，0 表示全部 | 25 |
| `--strict` | Skill 专用，排除所有静态读取推断，只保留明确记录 | 关闭 |
| `--json` | 标准输出为完整 JSON，无表格或横幅 | 关闭 |
| `--markdown` | 标准输出为完整 Skill Markdown 报告，与 `--json` 互斥 | 关闭 |
| `--mcp` | 选择 MCP 统计，支持表格和 JSON；与 `--strict`、`--markdown` 互斥 | 关闭，默认统计 Skill |
| `--output PATH` | 与 `--markdown` 或 `--json` 配合，直接写无 BOM UTF-8 文件，创建父目录并覆盖同名文件 | 不写文件，输出到终端 |
| `--codex-dir PATH` | Codex 数据根目录 | `~/.codex` |
| `--provenance` | Skill 专用，追加离线当前来源候选；不代表历史作者归属，不能与 `--mcp` 合用 | 关闭 |
| `--skill-root PATH` | 来源模式的 standalone Skill 根 | 所选 Codex home 的 skills |
| `--plugin-root PATH` | 来源模式的一个完整插件版本目录 | 不读插件缓存 |
| `--provenance-map PATH` | 来源模式的 version=1 JSON 用户声明，读取日志前整体校验 | 不使用映射 |
| `--help` / `-h` | 查看帮助 | — |
| `--version` / `-v` | 查看版本 | — |

`--limit` 只影响表格展示，不改变汇总值、JSON 的完整 Skill/工具列表或 Markdown 报告。未知参数、位置参数、互斥输出选项和非法数值会报错并以非零状态退出；参数错误在扫描日志前被拒绝。

## 怎样理解 Skill 结果

| 表格列 | 含义 |
| --- | --- |
| Skill | 归一化后的 Skill 名称 |
| Total | 去重后保留的使用记录数 |
| Explicit | 明确记录，包括手动 `$skill` 和明确的 Skill 注入；等于 Total − Inferred |
| Inferred | 从受支持的静态 `SKILL.md` 读取命令推断出的记录 |
| Last recorded | 最新保留记录的 ISO 8601 时间 |

默认同时统计明确与推断记录。希望采用更保守的口径时，加上 `--strict`。即使是明确记录，也不能单凭日志判断 Skill 是否成功执行。

结果按 Total 降序排列，同次数时按名称排序。日期明细按运行机器的本地日期统计；`--days` 是滚动时间窗口，不是从某天零点开始计算。

## 导出 Markdown 报告

报告包含概览、统计窗口、strict 状态、时区、完整 Skill 排名和统计限制，不展开项目目录等明细。推荐由程序直接写入 UTF-8 文件：

```powershell
node ./dist/index.mjs --days 30 --markdown --output .local/skill-usage.md
```

程序会创建缺失的父目录、覆盖指定文件，成功时不向终端输出报告正文。路径有空格时加引号。直接写入绕过 shell 文本解码；Windows 下仅在管道末尾指定 `Set-Content -Encoding utf8`，不能修正前面已经发生的错误转码。如果旧报告已出现中文乱码，请使用相同统计选项重新导出。

报告不受 `--limit` 截断。阅读时使用支持管道表格的 Markdown 阅读器；名称中的结构字符会转义（如源码中的 `&#58;` 在预览中显示为冒号，这不属于中文编码乱码）。格式说明见 [Markdown 报告](docs/markdown-report.md)。

## 使用 Skill JSON

`--json` 适合脚本读取和后续分析。下面是包含一个 Skill 的虚构示例：

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-20T08:00:00.000Z",
  "source": "codex",
  "windowDays": 30,
  "filesScanned": 4,
  "elapsedMs": 12,
  "totals": { "invocations": 3, "manual": 1, "auto": 2, "skills": 1 },
  "skills": [
    {
      "skill": "example-skill",
      "total": 3,
      "manual": 1,
      "auto": 2,
      "inferredAuto": 1,
      "lastUsedAt": "2026-10-20T07:30:00.000Z",
      "sources": { "codex": 3 },
      "daily": { "2026-10-20": 3 },
      "projects": { "D:/demo-project": 3 },
      "aliases": ["example-skill"]
    }
  ],
  "strict": false,
  "timeZone": "Asia/Shanghai"
}
```

- `windowDays: null` 表示全部历史；`strict` 记录本次是否排除推断，`timeZone` 说明日期明细使用的时区。
- `auto` 包含自动注入与推断记录，`inferredAuto` 是它的子集；`total = manual + auto`。
- `daily`、`projects`、`aliases` 分别保存日期计数、项目目录计数和原始名称别名。
- `filesScanned` 是候选会话文件数加一个 history 路径，即使 history 不存在也加 1，不能当作成功读取数。
- 当前 `schemaVersion` 为 1。读取器应允许增加字段；不兼容的字段或统计口径变更会提升版本。

在 PowerShell 中直接读取统计结果：

```powershell
$report = node ./dist/index.mjs --days 30 --json | ConvertFrom-Json
$report.skills | Select-Object skill, total, inferredAuto, lastUsedAt
```

直接保存 UTF-8 JSON 到已被 Git 忽略的本地目录：

```powershell
node ./dist/index.mjs --days 30 --json --output .local/skill-usage.json
```

导出的 JSON 包含项目目录等本机信息，分享前请检查内容。

## 查看 Skill 当前来源

```powershell
node ./dist/index.mjs --provenance --days 30
node ./dist/index.mjs --provenance --json --output .local/skill-provenance.json
node ./dist/index.mjs --provenance --provenance-map .local/skill-provenance-map.json --markdown --output .local/skill-provenance.md
```

来源资料只包含当前候选；不会将今天的作者写成历史调用作者，不按作者重新分配使用次数。自动元数据标 E3 文件声明，映射标 U 用户声明；多个候选或不同声明明确显示 ambiguous/conflict。目录名、`.system`、OpenAI 自声明和公开仓库地址不能认证官方、原创或开源许可。默认离线、只读、有界，不读取秘密配置或修改安装；插件需显式指定一个版本根。

启用后 JSON 仅增补顶层 provenance，旧 source=codex、skills 和计数不变；默认 JSON 完全不增加字段。字段、严格映射格式、支持范围及隐私限制见 [Skill 当前来源资料](docs/skill-provenance.md)。

## 使用 MCP 统计

```powershell
node ./dist/index.mjs --mcp --days 30 --limit 10
node ./dist/index.mjs --mcp --codex-dir "D:/Codex Data/.codex" --json
node ./dist/index.mjs --mcp --days 30 --json --output .local/mcp-usage.json
```

MCP 表格按服务端和完整工具名分组，展示以下信息：

| 列 | 含义 |
| --- | --- |
| Server / Tool | 明确识别的服务端和完整工具名；未知服务端为 `-`，不从名称猜测 |
| Calls | 按会话和调用身份去重后的调用数 |
| Succeeded / Failed | 有明确结果证据的成功/失败调用 |
| Unknown | 结果缺失、冲突或证据不足的调用，不归入成功或失败 |
| Avg ms | 可靠耗时样本的均值；没有样本显示 `-`，观测到零耗时显示 `0.00` |

调用数满足 `Calls = Succeeded + Failed + Unknown`。耗时均值的分母是有可靠耗时的调用数，不是全部调用数，也不使用日志时间差推算执行耗时。

`--mcp --json` 输出独立的 `kind: "mcp"` 报告，包含 `schemaVersion`、`generatedAt`、`source`、`windowDays`、`elapsedMs`、`scan`、`totals` 和完整 `tools`。每个工具包含调用计数、最新调用开始时间、`durationSamples` 和 `totalDurationMs`；不输出调用参数、结果正文或原始事件。原有 Skill JSON 格式保持不变。

`scan` 以及表格末尾的计数用于排查数据质量：`filesRead/filesScanned` 表示完整读完的文件数/候选文件数，`missingDirectories` 表示缺失目录，`directoryErrors`、`unreadableFiles`、`malformedLines` 等暴露扫描问题。这些计数覆盖整次扫描，不随 `--days` 过滤，也不代表日志完整覆盖率。MCP 不读取 `history.jsonl`，其 `filesScanned` 不包含 Skill 模式额外计入的 history 路径。

当前支持的日志结构和边界经过合成样本验证，尚未对真实 Codex 版本作全面兼容认证。没有明确结果标志的普通文本保留 Unknown；代码封装内没有独立调用记录的 MCP 调用可能无法计入。具体输入结构、扫描字段和覆盖限制见 [MCP 统计说明](docs/mcp-statistics.md)。

## 数据来源与统计边界

Skill 统计读取所选 Codex 数据目录中的以下内容；MCP 仅读取两个会话目录：

```text
.codex/
  sessions/           当前会话日志
  archived_sessions/  已归档会话日志
  history.jsonl       用户输入历史
```

缺失的目录或历史文件按无可用记录处理，损坏的 JSONL 行会被跳过。统计覆盖可识别的日志信号，不能用于计算 Skill 的成功率或准确召回率，也不能可靠区分子 Agent。

<details>
<summary>去重规则与读取识别范围</summary>

- 明确记录按同一会话、Skill、秒去重。
- 推断记录在同一会话中每个 Skill 最多保留一次；筛选范围内存在明确记录时，抑制该会话该 Skill 的推断记录。
- history 与会话日志中的手动信号在 120 秒窗口内合并；手动调用附近 300 秒内的注入回声被抑制。
- 注入重放按跨会话的 Skill／秒合并，可能合并独立会话在同一秒的记录。
- 支持部分 Windows／POSIX 静态读取命令、`.system` 路径和 function／custom 工具调用。动态参数、任意 shell 写法和 here-document 不保证识别。

</details>

## 常见问题

**结果为空，或只有很少记录？**

确认 `--codex-dir` 指向实际数据目录，而非项目目录或其 `sessions` 子目录。尝试去掉 `--days` 扩大时间范围，去掉 `--strict` 查看推断记录。若仍为空，可能是日志中没有受支持的使用信号；日志覆盖范围见上节。

**为什么加上 `--strict` 后数量明显减少？**

部分使用仅能从 `SKILL.md` 读取推断；`--strict` 会排除这些记录。这个差值不代表执行失败数。

**为什么 JSON 比表格包含更多 Skill？**

表格默认只展示前 25 行，JSON 始终包含完整列表。使用 `--limit 0` 查看全部表格行。

**MCP 中 Unknown 较多，是否表示调用失败？**

不表示。只有明确结果证据才计入 Succeeded 或 Failed；缺失结果、纯文本、冲突、取消或传输错误等可能保留 Unknown。先检查 scan 计数及支持的日志结构，不能直接用这些记录判断总体成功率。

**提示找不到 `dist/index.mjs`？**

先在项目根目录执行 `pnpm run build`，再运行命令。构建产物不保存在 Git 中。

## 开发与维护

技术栈为 TypeScript、Node.js ESM、pnpm、tsdown 和 Node 内置测试运行器。检查命令：

```powershell
pnpm run test
pnpm run typecheck
pnpm run test:cli
```

`test` 编译并执行核心、契约、Markdown、MCP、MCP 表格与来源测试，同时检查类型负例；`test:cli` 包含构建及 Skill/MCP/来源 CLI 集成测试。测试使用临时合成日志和元数据。

维护操作见 [项目维护卡](MAINTENANCE.md)，内部数据契约见 [公共契约](docs/usage-contract.md)。当前正式规范保存在 [OpenSpec specs](openspec/specs/)，已完成变更与验收记录保存在 [归档](openspec/changes/archive/)。使用 `openspec validate --all --strict --no-interactive` 检查正式规范和活动变更，使用 `openspec validate --archived --strict --no-interactive` 检查已归档任务。

## 来源与许可说明

Codex 采集、静态读取解析、归一化、聚合和核心回归测试迁自 [lovstudio/skillusage](https://github.com/lovstudio/skillusage) 的本地工作副本，参考基线为 `99f7c5f`，并包含迁移时的 Windows／custom 解析修复。CLI 参数、表格及公共报告组装由本项目实现。

源包和本项目的 `package.json` 均声明 MIT；当前仓库尚未补齐上游独立 `LICENSE` 文件及版权声明核对。公开分发前需要完成这部分来源核验，README 的来源说明不能替代许可证文本。
