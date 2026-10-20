# agent-usage

在终端查看本地 **Codex Skill 使用记录**：哪些 Skill 最常出现、最近何时被使用，以及哪些记录来自明确调用、哪些来自静态读取推断。

统计在本机完成，只读扫描 Codex 日志，不执行日志中的代码。无需 API Key、数据库或常驻服务。

## 功能

- 按使用记录数展示 Skill 排名和最近记录时间。
- 按最近 N 天筛选，支持仅统计明确记录。
- 自动合并重复信号，保留 Skill 名称别名。
- 输出终端表格或完整 JSON；JSON 同时包含按日期、项目目录划分的计数。
- 支持指定 Codex 数据目录，读取当前及已归档的会话日志。

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

# 查看帮助和版本
node ./dist/index.mjs --help
node ./dist/index.mjs --version
```

### 参数

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--days N` / `-d N` | 最近 N×24 小时；N 为正有限数，支持小数 | 全部历史 |
| `--limit N` / `-l N` | 表格最多展示 N 行；N 为非负整数，0 表示全部 | 25 |
| `--strict` | 排除所有静态读取推断，只保留明确记录 | 关闭 |
| `--json` | 标准输出为完整 JSON，无表格或横幅 | 关闭 |
| `--codex-dir PATH` | Codex 数据根目录 | `~/.codex` |
| `--help` / `-h` | 查看帮助 | — |
| `--version` / `-v` | 查看版本 | — |

`--limit` 只影响表格展示，不改变汇总值或 JSON 中的 Skill 列表。未知参数、位置参数和非法数值会报错并以非零状态退出；参数错误在扫描日志前被拒绝。

## 怎样理解结果

| 表格列 | 含义 |
| --- | --- |
| Skill | 归一化后的 Skill 名称 |
| Total | 去重后保留的使用记录数 |
| Explicit | 明确记录，包括手动 `$skill` 和明确的 Skill 注入；等于 Total − Inferred |
| Inferred | 从受支持的静态 `SKILL.md` 读取命令推断出的记录 |
| Last recorded | 最新保留记录的 ISO 8601 时间 |

默认同时统计明确与推断记录。希望采用更保守的口径时，加上 `--strict`。即使是明确记录，也不能单凭日志判断 Skill 是否成功执行。

结果按 Total 降序排列，同次数时按名称排序。日期明细按运行机器的本地日期统计；`--days` 是滚动时间窗口，不是从某天零点开始计算。

## 使用 JSON

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

在 PowerShell 7 中保存 JSON 到已被 Git 忽略的本地目录：

```powershell
New-Item -ItemType Directory -Force .local | Out-Null
node ./dist/index.mjs --days 30 --json | Set-Content -Encoding utf8 .local/skill-usage.json
```

导出的 JSON 包含项目目录等本机信息，分享前请检查内容。

## 数据来源与统计边界

工具读取所选 Codex 数据目录中的以下内容：

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

**提示找不到 `dist/index.mjs`？**

先在项目根目录执行 `pnpm run build`，再运行命令。构建产物不保存在 Git 中。

## 开发与维护

技术栈为 TypeScript、Node.js ESM、pnpm、tsdown 和 Node 内置测试运行器。检查命令：

```powershell
pnpm run test
pnpm run typecheck
pnpm run test:cli
```

`test` 编译并执行核心与契约测试，同时检查类型负例；`test:cli` 包含构建和 CLI 集成测试。测试使用临时合成日志。

维护操作见 [项目维护卡](MAINTENANCE.md)，内部数据契约见 [公共契约](docs/usage-contract.md)。需求与验收记录保存在 [OpenSpec changes](openspec/changes/)；可用 `openspec validate <change-id> --strict --no-interactive` 校验对应变更。

## 来源与许可说明

Codex 采集、静态读取解析、归一化、聚合和核心回归测试迁自 [lovstudio/skillusage](https://github.com/lovstudio/skillusage) 的本地工作副本，参考基线为 `99f7c5f`，并包含迁移时的 Windows／custom 解析修复。CLI 参数、表格及公共报告组装由本项目实现。

源包和本项目的 `package.json` 均声明 MIT；当前仓库尚未补齐上游独立 `LICENSE` 文件及版权声明核对。公开分发前需要完成这部分来源核验，README 的来源说明不能替代许可证文本。
