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

样例两来源共有 3 组：日志明确 2、日志推断 3、Hook 4、并集 6。这只是规则演示，不表示当前个人使用量。

## 使用自己的数据

为两个采集适配器明确配置同一数据实例及技能映射。配置位于所选 Codex home 的 usage-skills/config.json：

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

~~~powershell
node dist/index.mjs --skill-method logs --codex-dir E:/example/codex-home --days 30
node dist/index.mjs --skill-method hooks --codex-dir E:/example/codex-home --json
node dist/index.mjs --skill-method combined --codex-dir E:/example/codex-home --limit 0
~~~

logs 只扫描该根下受支持的 sessions、archived_sessions 和 history.jsonl。hooks 只读取 usage-skills 下已留存的 JSON 包。combined 读取两者；文件属于不同 sourceInstanceId 时拒绝拼接，必须分别查询。--skill-evidence 单独重放指定包，不再额外扫描本机日志。它可与 days、limit、json/output 合用，但不能与 --hooks、--mcp、--provenance、--strict、--markdown 合用。

## 去重与未知

1. 同实例、同来源、同会话、同 sourceRecordId 的相同最小事实只保留一次。ID 相同但内容不同则保存冲突候选。
2. 按实例、会话、轮次、技能身份归组。日志组有指定或注入就归为 Explicit，否则读取尝试归为 Inferred；Hook 每组计一次。
3. Unique Total 是选中来源组的并集。同一轮的指定与读取可以是不同事实，保留二者但统计一次。
4. 缺少身份、时间或冲突时进入 deduplication.unresolvedEvidence，影响相应计数为 null。没有可靠 turnId 的 history 记录也不能硬配到附近轮次。
5. comparison 保存已确定组的 matched、logsOnly、hooksOnly 身份，未决项另看 unresolvedEvidence。组较多不自动表示覆盖更完整。

每条记录的 sourceRecordId 使用原生消息/调用身份和阶段；必要时使用稳定原文摘要。日志 sourceRef 保存文件标识摘要及行号以便本机核查，不保存命令全文。普通摘要不能保证匿名。采集规则只表示信号或读取尝试，不证明技能执行成功。

## 本地 Hook 采集

独立入口为 dist/skill-hook-entry.mjs，仅接受已知的 PreToolUse stdin 输入。脚本使用配置中的同一映射，提取技能文件读取，输出最小 JSON 包至 --home 指定根的 usage-skills；临时文件原子更名，既不写 Hook 决策 stdout，也不因采集异常阻断工具。异常仅输出固定诊断。

需要在 Codex 中按正常流程审查、启用及信任 Hook。以下仅为待用户替换路径并审查的配置样例；CLI 不会替用户安装或自动启用：

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

当前未认证：实际客户端 PreToolUse 执行、正常登录/信任后的原生 stdin 样本、所有客户端路径与个人历史完整性。详见 docs/skill-hook-validation.md。不能把独立脚本的合成 stdin 测试称作真实宿主 Hook 验证。
