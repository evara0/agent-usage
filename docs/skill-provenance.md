# Skill 出处清单

`--provenance` 列出本机映射登记的全部技能，检查当前文件并读取出处声明。它不读取使用日志，不筛选使用过的技能，不按作者重算使用次数，也不证明历史来源或官方身份。

## 使用

```powershell
node ./dist/index.mjs setup
node ./dist/index.mjs --provenance --limit 0
node ./dist/index.mjs --provenance --json --output .local/skill-provenance.json
```

数据目录按 `--codex-dir`、`CODEX_HOME`、`~/.codex` 选择。清单来自 `usage-skills/config.json` 的全部 `skills` 条目；读取失败会提示初始化或校验错误，不自动创建配置。查询始终只读。

新增或改变发现范围时先显式刷新：

```powershell
node ./dist/index.mjs skills refresh --project-root E:/your-project
node ./dist/index.mjs skills refresh --skill-root E:/your-skills
node ./dist/index.mjs skills refresh --plugin-root E:/plugins/package/1.0.0
```

`--provenance --days`、`--strict`、`--markdown` 以及用量模式组合会在读取前拒绝。旧 `--provenance --skill-root/--plugin-root` 改为上面的刷新命令。`--limit` 只限制表格映射条目数，同一条目的多路径候选完整展开；JSON 始终完整。

## 当前文件状态

| 条目状态 | 含义 |
| --- | --- |
| present | 一个存在的普通技能文件，其他配置路径均可确定缺失 |
| ambiguous | 两个或更多不同的存在文件，分别保留元数据候选 |
| missing | 所有配置路径均缺失 |
| unmapped | 只有名称登记，没有路径 |
| unresolved | 路径不可检查、链接或不支持的文件类型，存在性未完全确定 |

每个路径保存 SHA-256 `pathId` 和 `present/missing/unreadable/skipped_link/unsupported` 状态，不输出原始绝对路径。映射保留历史路径，因此已登记不等于当前存在。同名但不同 `skillKey` 的条目不合并；Windows 同一路径的大小写与分隔符别名不制造多个候选。

普通文件存在但元数据损坏或过大时，仍是存在文件，`metadata` 可为空；不能把缺少作者声明解释为文件不存在。

## 出处字段与证据

| 字段 | 来源与边界 |
| --- | --- |
| publisher | 相邻插件清单的 author.name，仅为包发行方声明 |
| originalAuthors | Skill front matter 的 metadata.author 或用户作者列表 |
| license | Skill 与包级许可证声明；不判断法律适用性 |
| distribution | 官方/第三方/自行发布类别，只接受用户声明 |
| acquisition | 获取途径，只接受用户声明，不从目录推定渠道 |
| localState | 原创/导入/改写/fork，只接受用户声明 |

字段为 `{status, values}`：unknown 表示无已接受声明，declared 表示单一声明值，conflict 表示多个不同值待复核。values 保留 `value/evidence/scope`，其中 `file_declared` 是文件声明，`user_declared` 是用户声明，scope 为 skill/package/user。不同范围的许可证多值不等同法律冲突。

仅检查映射指向的文件，以及其技能集合相邻的 `plugin.json` 或 `.codex-plugin/plugin.json`；不枚举未登记兄弟技能，不读取资产、Git、网络或使用历史。插件 publisher 不自动成为原作者，`.system`、目录名和文件自称均不是官方认证。

## 用户出处声明

技能身份映射与出处声明是两个文件。身份由 setup/skills refresh 维护；出处补充文件仍使用 `version=1`，通过 `--provenance-map` 显式提供。

```json
{
  "version": 1,
  "entries": [
    {
      "installationId": "standalone:example",
      "publisher": "示例维护团队",
      "originalAuthors": ["作者甲", "作者乙"],
      "distribution": "third_party",
      "acquisition": "local_copy",
      "license": "MIT",
      "localState": "adapted"
    }
  ]
}
```

```powershell
node ./dist/index.mjs --provenance --provenance-map .local/skill-provenance-map.json --json
```

`installationId` 精确匹配报告中的 `skills[].skillKey`，不会按别名猜配。未匹配声明计入 unmatchedMappings，不额外创建清单条目；registered 身份也只有在本机技能映射中登记后才列出，不证明安装。`aliases` 可保留为用户声明的兼容字段，但不会把两个技能合并。用户值与文件值并列，不覆盖文件声明。

distribution：openai_official / third_party / self_published；acquisition：bundled / plugin_catalog / git_install / local_copy / local_create；localState：declared_original / imported / adapted / forked。

声明文件最多 256 项、64 KiB；拒绝未知字段、重复身份、非法枚举或包含控制符、邮箱、路径的声明值。出错不回显正文，不写报告文件。声明未匹配不代表技能未使用。

## JSON 与迁移

新出处报告是独立 `schemaVersion=2`、`kind=skill-provenance-inventory`，包含 `observedAt`、`temporalScope=current_reference_only`、`sourceInstanceId`、`skills` 和 `diagnostics`。每项含 `skillKey/names/status/paths/declarations`，每个路径可带独立 metadata 候选。

旧调用方应从独立报告的 skills 读取，不再读取用量报告的 provenance.inventory/associations。不存在使用次数、时间窗口或旧聚合关联；`observedAt` 只是当前检查时间。旧低层兼容渲染/关联函数暂保留，不再被出处 CLI 调用，也不依赖旧 SkillStats 类型。

符号链接及路径中的 junction 不跟随；普通元数据文件必须为 UTF-8 且不超过 64 KiB。诊断计数区分缺失、不可读、无效/不支持元数据、链接和未匹配声明。分享 JSON 前仍需检查自己填写的身份和声明文字。
