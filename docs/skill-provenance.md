# Skill 当前来源资料

本功能已实现离线来源候选和显式用户声明。它为使用统计提供当前资料，不确定调用当时的作者，也不生成历史作者/来源调用次数排行榜。设计依据见 [来源调研](skill-provenance-research.md)，实现范围以本文为准。

## 使用

在项目根目录构建后运行：

```powershell
pnpm run build
# 默认只读所选 Codex home 下的 skills；不会扫描全部插件缓存
node ./dist/index.mjs --provenance --days 30
node ./dist/index.mjs --provenance --json
node ./dist/index.mjs --provenance --markdown --output .local/skill-provenance.md

# 另选一个 standalone 根和一个完整插件版本目录（均为示例路径）
node ./dist/index.mjs --provenance --skill-root "D:/example/skills" --plugin-root "D:/example/plugin/1.0.0" --json
node ./dist/index.mjs --provenance --provenance-map .local/skill-provenance-map.json --json --output .local/skill-provenance.json
```

`--skill-root`、`--plugin-root`、`--provenance-map` 必须与 `--provenance` 合用；不能与 `--mcp` 合用。根路径不自动展开环境变量/波浪号，按 shell 传入的路径解释。插件根是一个包版本目录，不是整个插件缓存根。未启用时不读来源元数据，旧 JSON 不增加字段。

## 分开的信息与证据

| 字段 | 含义与自动输入 |
| --- | --- |
| publisher | 发行方。插件清单 author.name 仅为包的发行方声明，不填入原作者 |
| originalAuthors | 原作者列表。只读受限 front matter metadata.author，或用户显式列表；团队/多人协作可保留 |
| distribution | OpenAI 官方/第三方/自行发布的用户声明；自动读取始终 unknown，目录和名称不认证官方 |
| acquisition | 如何取得当前参考实例；只接受用户声明，不把包目录存在当成安装渠道证明 |
| license | Skill 的 license 与包级 license 声明；不据此判断开源适用性，公开 GitHub 地址也不构成授权证据 |
| localState | 原创/导入/改写/fork 的用户声明；本地路径或无 Git 不能证明原创 |

每个字段是 `{status, values}`；status 为 unknown（没有已接受声明）、declared（单一值）或 conflict（多值待复核）。values 保留 value、evidence 和 scope。`file_declared` 为 E3 文件自声明，`user_declared` 为 U 用户声明；scope 为 skill/package/user。同值可保留多种证据。多个协作者在同一个 originalAuthors 数组内，不算互相冲突。不同范围的许可证出现多值时，conflict 表示需要复核适用范围，并非断言法律上冲突。

**本期没有 E1 可信安装/发布认证或 E2 仓库版本与内容核验。** 文件自称 OpenAI 只展示声明；不能通过用户映射把 U 升为 E1。未知值省略声明即可，不能填写 `unknown` 到枚举中代替缺失状态。

## 显式映射

先查看 `--provenance --json` 的 inventory.id，再建立本地 JSON。推荐保存到 Git 忽略的 `.local/`，不要提交真实私人归属资料。以下是合成示例：

```json
{
  "version": 1,
  "entries": [
    {
      "installationId": "standalone:example",
      "aliases": ["old-example"],
      "publisher": "示例维护团队",
      "originalAuthors": ["示例作者甲", "示例作者乙"],
      "distribution": "third_party",
      "acquisition": "local_copy",
      "license": "MIT",
      "localState": "adapted"
    },
    {
      "installationId": "registered:personal-example",
      "aliases": ["personal-example"],
      "originalAuthors": ["本人"],
      "acquisition": "local_create",
      "localState": "declared_original"
    }
  ]
}
```

映射精确选择 installationId。未发现的普通 selector 计 unmatchedMappings，不创建虚假安装。`registered:<标识>` 可创建 kind=user_registered 的资料，仅表示用户注册，未证明已安装；必须给非空 aliases。用户值与文件值并列，不能静默覆盖。

| 枚举字段 | 允许值 |
| --- | --- |
| distribution | openai_official / third_party / self_published |
| acquisition | bundled / plugin_catalog / git_install / local_copy / local_create |
| localState | declared_original / imported / adapted / forked |

映射必须为 version=1、entries 数组（最多 256 项），不接受未知键、重复 selector、重复别名或作者、错误类型/枚举。显示名/许可为 1–120 字符的无首尾空格单行文本；禁止控制符、邮箱、冒号和路径/URL 分隔符。作者及别名数组各 1–32 项；名称/别名使用字母、数字、下划线、点、连字符及命名空间冒号，不能用路径充当别名。无效映射整体拒绝，在读取使用日志前退出；错误不回显输入、路径或凭据。错误输入不会写出指定的报告文件。

## 身份、别名与历史边界

- standalone ID：`standalone:<目录名>` 或 `standalone:.system/<目录名>`，精确候选名是目录名与合法 front matter name。`.system` 仅用于定位，不授予官方身份。
- 插件 ID：`plugin:<包名>@<版本或 unknown>:skills/<目录名>`；自动候选名必须是 `<包名>:<目录名或Skill名>`。不会用插件短 Skill 名静默匹配；确需短名可由用户显式注册 aliases，出现多个匹配仍显示 ambiguous。
- IDs 只在本次选定根内有效，不是全局安装 ID，也不证明启用状态。未使用的本地资料同样列在 JSON/Markdown inventory 中。

每个现有统计项在 associations 中只提供当前候选：无匹配为 unknown；全部原始 aliases 唯一指向同一身份为 candidate；多身份、部分未解析或目录截断为 ambiguous。candidateIds、unresolvedAliases 解释歧义，不从规范化短名称猜测；不安全的输入名称在新增资料中显示 `[redacted]`。

报告 `temporalScope=current_reference_only`，observedAt 是本次观察时间。2020 年的调用也只会关联今天的候选，不能说当时由当前作者提供。删除、替换、升级、重命名后，下次观察可能不同，本程序不保存快照。跨版本/旧名称需要显式映射且仍是当前声明；多个注册版本共用别名为 ambiguous。旧统计已经合并的同名事件不能据此恢复原安装身份。

## 输出与兼容

Skill JSON schemaVersion 仍为 1；启用时仅新增顶层 `provenance`：

```text
provenance
  schemaVersion: 1
  observedAt: ISO 8601
  temporalScope: current_reference_only
  inventory: 当前资料及分字段声明
  associations: 现有统计项到当前候选身份的旁路关联
  diagnostics: 有限扫描质量计数
```

原 source=codex、sources、skills、totals、时间窗口和去重均不变；不将全部历史次数划给候选作者。表格追加来源区，limit 限制统计项数（同项多候选可展开多行）；JSON 与 Markdown 不受 limit 截断。Markdown 含完整关联、未解析别名和资料清单；原始结构化 values 以 JSON 为准。`--output` 继续直接写无 BOM UTF-8。

## 有界读取、隐私和离线行为

只读根目录一层及 `.system` 一层；插件只读单个版本清单与 `skills/` 一层，不读资产、Git、安装数据库或秘密配置。每个枚举目录最多检查 256 个目录项；standalone 最多收集 256 个候选，plugin 最多 256 个，用户注册最多 256 项。元数据/映射每文件至多 64 KiB，必须为普通 UTF-8 文件。符号链接/junction（包括根路径的链接组件）不跟随；链接检查针对观察时文件系统，不提供对并发恶意替换的隔离保证。

Skill 只支持简单单行 name/license、两空格 metadata.author；复杂 YAML、重复目标字段、非法显示值保留 unknown，并计 unsupportedMetadata。`agents/openai.yaml`、`SKILL.json` 等不被当作作者回执。插件根 portable manifest 必须有已知 schema；存在 root plugin.json 时不混用兼容 overlay 身份。兼容包 skills 只接受 `./skills/` 或该单项数组，自定义路径不遍历；可移植包固定 `skills/`。

诊断为数值计数：missingFiles、unreadableFiles、invalidMetadata、unsupportedMetadata、skippedLinks、truncatedDirectories、unmatchedMappings。缺文件/访问失败不会输出原始异常或改变使用计数；目录不完整时不得把候选视为全机唯一安装。默认始终离线，没有自动网络请求或上传；仓库 URL、个人邮箱、绝对路径不被采集到新增来源资料。原使用 JSON 仍包含 projects 等原有本机信息，本功能不为整个旧报告提供脱敏保证。分享前审查显示名与用户映射；映射仍可能包含用户主动填写的私人文字。

## 当前限制

覆盖受限 YAML 和单一显式插件版本根；不扫描全部缓存、不判断启用/安装时间、无上游摘要与可信发布链、无开源法律适用性判断、无事件时快照。真正的 E1/E2 核验、跨根稳定身份和历史来源统计须另有 OpenSpec。
