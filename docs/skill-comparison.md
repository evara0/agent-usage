# Skill 双来源证据统计

本功能通过显式 --skill-method 启用，原默认 Skill、MCP、--hooks 处理器统计和来源资料保持原行为。

## 重放样例

在仓库根目录构建后运行（文件均为合成示例）：

~~~powershell
pnpm run build
node dist/index.mjs --skill-method logs --skill-evidence docs/examples/skill-comparison-combined.json
node dist/index.mjs --skill-method hooks --skill-evidence docs/examples/skill-comparison-combined.json
node dist/index.mjs --skill-method combined --skill-evidence docs/examples/skill-comparison-combined.json --json --output .local/skill-comparison.json
~~~

列固定为 Skill、Logs Explicit、Logs Inferred、Hooks、Unique Total、Last Recorded。0 是已知零；— 是未选择的来源或无法确定的值。时间按 JSON 的 timeZone 显示完整日期和分钟。页脚 skill-turns 是技能轮次记录之和，不是独立会话轮次数。

日常查询默认 countPolicy=resolved，表格标注 Counts Resolved evidence，仅对身份完整的证据去重计数；未决候选完整保留在 JSON，并在当前范围的页脚单列数量和缺失字段。它不是包含未决记录的完整使用总量。加 --skill-counts strict 后，可能受未决影响的严格计数仍为 —，另列已解析证据组数。未选来源或窗口外未决不触发提示。

countPolicy 是 v1 的可选字段；旧包省略时按 strict 校验原汇总。日常本机查询默认 resolved，重放已声明 countPolicy 的报告时尊重原声明；可用 --skill-counts 显式切换，生成的新报告包含当前策略。旧版解析器不能识别此新字段时应拒绝输入，不能按另一种口径误读汇总。

样例两来源共有 3 组：日志明确 2、日志推断 3、Hook 4、并集 6。这只是规则演示，不表示当前个人使用量。

## 使用自己的数据

首次运行 node dist/index.mjs setup，自动扫描自己的用户级、系统级技能和插件缓存，为两个采集适配器生成同一数据实例及技能映射。配置位于所选 Codex home 的 usage-skills/config.json，人工扩展时采用下列格式：

~~~json
{
  "schemaVersion": 1,
  "sourceInstanceId": "my-codex-instance",
  "skills": [
    {
      "skillKey": "standalone:my-skill",
      "names": ["my-skill"],
      "paths": ["E:/example/skills/my-skill/SKILL.md"]
    }
  ]
}
~~~

sourceInstanceId 是用户确认的同一数据实例标识，不能每次启动随机生成。names 匹配原始指定/注入名称，paths 匹配原始静态读取路径；路径应为绝对路径。插件同名、多项目相对路径及多候选不要通过短名称猜测；没有唯一显式映射就进入待核对集合。此配置不是旧 --provenance-map。

新增技能、插件版本或项目内技能后，需补充明确的 paths 映射。查询本地 native Hook 包时，CLI 仅对本采集器 v1、同实例的原生读取记录，将 sourceRecordId 的已记录路径 SHA-256 与显式配置路径精确匹配；唯一匹配可修复缺 skillKey 的读取投影，原始包不变。Windows 两种分隔符均核对，但同一路径配置到多个技能、缺 turnId、摘要不符或其他 producer 都不会据此补成确定计数。显式 --skill-evidence 重放不读取个人映射，也不隐式修正导入包。

正式更新命令是 node dist/index.mjs skills refresh。可重复提供 --project-root（只扫描该项目 .agents/skills 与 .codex/skills）、--skill-root（技能集合目录）、--plugin-root（单个 package/version 插件版本目录）。范围保存在 usage-skills/settings/discovery.json，不塞入旧采集器读取的 config.json。刷新保留本机 sourceInstanceId、人工别名、已有路径身份和已移除文件的历史映射；有变更时备份旧配置。缓存中的多个插件版本只作为身份候选，不表示都已启用；同名歧义进入未决。

初始化、刷新和新统计模式的目录优先级为 --codex-dir、CODEX_HOME、~/.codex。查询不自动写配置。发现失败会列出警告；链接不跟随，扫描目录数、映射数和配置大小有界。格式损坏的旧配置不会被初始化覆盖。

~~~powershell
node dist/index.mjs --skill-method logs --codex-dir E:/example/codex-home --days 30
node dist/index.mjs --skill-method hooks --codex-dir E:/example/codex-home --json
node dist/index.mjs --skill-method combined --codex-dir E:/example/codex-home --limit 0
~~~

logs 只扫描该根下受支持的 sessions、archived_sessions 和 history.jsonl。hooks 只读取 usage-skills 下已留存的 JSON 包。combined 读取两者；不同 sourceInstanceId 拒绝拼接。--skill-evidence 单独重放指定包，不额外扫描个人日志；可与 days、limit、json/output 或 markdown/output 合用，JSON 与 Markdown 互斥。--hooks、--mcp、--provenance、旧 --strict 仍不可混用。Markdown 与 JSON 使用同一报告模型，limit 只截断终端表格。

## 去重与未知

1. 同实例、同来源、同会话、同 sourceRecordId 的相同最小事实只保留一次。ID 相同但内容不同则保存冲突候选。
2. 按实例、会话、轮次、技能身份归组。日志组有指定或注入就归为 Explicit，否则读取尝试归为 Inferred；Hook 每组计一次。
3. Unique Total 是选中来源组的并集。同一轮的指定与读取可以是不同事实，保留二者但统计一次。
4. 缺少身份、时间或冲突时进入 deduplication.unresolvedEvidence；resolved 口径仅统计其余证据并明确提示排除量，strict 口径使受影响计数为 null。没有可靠 turnId 的 history 记录不能硬配到附近轮次。
5. comparison 保存已确定组的 matched、logsOnly、hooksOnly 身份，未决项另看 unresolvedEvidence。组较多不自动表示覆盖更完整。

每条记录的 sourceRecordId 使用原生消息/调用身份和阶段；必要时使用稳定原文摘要。日志 sourceRef 保存文件标识摘要及行号以便本机核查，不保存命令全文。普通摘要不能保证匿名。采集规则只表示信号或读取尝试，不证明技能执行成功。

日志中的相对读取路径只依据原始 session/turn cwd 和工具调用中静态 workdir/cwd 解析；工具工作目录优先。没有原始目录、目录由变量生成或是 Windows 驱动器相对路径时不使用当前进程目录补齐，继续待核对。

## 本地 Hook 采集

独立入口为 dist/skill-hook-entry.mjs，仅接受已知的 PreToolUse stdin 输入。脚本使用配置中的同一映射，提取技能文件读取，输出最小 JSON 包至 --home 指定根的 usage-skills；临时文件原子更名，既不写 Hook 决策 stdout，也不因采集异常阻断工具。异常仅输出固定诊断。

正式安装命令为 node dist/index.mjs hooks install，可加 --codex-dir。它将构建后的采集器固定安装到所选 home 的 tools/agent-usage/hooks/ 下，生成用户级 hooks.json，并保留其他处理器和配置备份；不修改 Codex 信任状态或 features 开关。用户需在 Codex 中启用 Hooks，并通过 /hooks 审查、信任。Windows 生成可审查的 launch.ps1 文本，按相同文本编码执行，使用原始字节流转发 stdin；不依赖 Node 路径是否含空格，也不修改 PowerShell 执行策略。POSIX 使用逐参数 shell 引号；目前仅 Windows 启动实测。

以下仍可作为手动配置样例，需替换路径并审查。统计查询不会隐式安装或启用 Hook：

~~~json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node E:/example/agent-usage/dist/skill-hook-entry.mjs --config E:/example/codex-home/usage-skills/config.json --home E:/example/codex-home",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
~~~

带空格路径须按实际宿主命令行规则加引号。默认示例匹配 Bash（包括受支持的 exec_command 路径）；其他事件路径和代码包装不能承诺覆盖。当前脚本以回调收到时间作为该读取尝试的发生时间近似值，缺少原生精确时间时不把它称为原生工具时间；窗口边界附近应核对原始证据。

回退：移除或禁用该 Hook 配置，保留导出数据。项目不修改个人全局配置或信任策略，不使用绕过信任的标志。

## 结构化输入与整理

Schema 见 schemas/skill-evidence-v1.schema.json，字段间关系、时区真实性、冲突影响和汇总重算同时由运行时校验。完整报告可重放；证据包可同时省略 skills 和 totals，提供时必须成对且与明细一致。mode 只影响查询，不删除原始来源证据；时间范围包含 start、不包含 end，两个边界均为 null 表示全历史。

见 skill-evidence-extraction.md 的整理指令与正反例。method 是原始来源；producer 区分自动采集、Codex 整理、人工转录。没有原始证据的声明必须放入未决，不伪造原生 ID。

文件上限 8 MiB，每个导入/合并查询最多 10,000 条候选证据，单 ID 上限 512 字符；输入必须为普通 UTF-8 文件且不经过链接组件。超限报错，不能通过静默截断得到“完整”统计。当前扫描器也限制单个日志文件 8 MiB；更大的文件返回未知诊断，后续可扩展有界流式解析。文件扫描失败或损坏行会保留为影响范围未知的待核对项，可能使总计为空值。

## 验证范围

当前可核对：JSON 样例重算、运行时校验、三种表格快照、跨批重放与冲突、合成日志和 stdin Hook 的本地脚本链路。

2026-10-30 已在本机 Windows / codex-cli 0.166.0-alpha.5.1 正常信任后验证真实 PreToolUse / Bash：当前聊天两次同轮读取形成两份 Hook 包，与两条日志归为一个共同技能轮次，表格为 0/1/1/1。尚未认证其他客户端路径与个人历史完整性。详见 docs/skill-hook-validation.md；独立脚本的合成 stdin 测试仍与真实宿主验证分开标记。

Windows 诊断入口：scripts/skill-hook-launcher.mjs 可包裹已构建采集器，参数为 --collector、--config、--home、--diagnostics-dir。诊断目录应放在 usage-skills 的独立子目录，latest.json 不属于技能证据；文件只反映最近一次调用。不要把以引号开头的可执行文件路径直接当作通用 PowerShell 命令。2026-10-30 的复现、启动修复和重新信任要求见 skill-hook-validation.md。
