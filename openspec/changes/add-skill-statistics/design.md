# Design

迁移 G:\skillusage 当前工作副本的 Codex 采集器、Acorn 静态读取解析器、归一化和聚合器及 57 项回归测试。不复制 Claude/daily/sparkline。包名 agent-usage，提供 agent-usage 和 skillusage 两个 CLI 入口，保留来源声明。

参数：--days/-d 正有限数，--limit/-l 非负整数（默认25，0表示全部），--strict、--json、--codex-dir、help/version。未知参数和位置命令报错。默认全部历史。JSON 保留 source: codex、windowDays、filesScanned、totals、skills 与 manual/auto/inferredAuto/sources/daily/projects/aliases，增加 elapsedMs。limit 仅影响表格。表格 Explicit = total - inferredAuto。

明确事件按 session/skill/秒去重；推断每 session/skill 一次并受保留范围内明确事件抑制。手动合并120秒，注入回声抑制300秒。保留跨 session skill/秒注入重放去重的已知限制。strict 排除推断。days 是滚动 N×24小时，daily 按本地时区。

保留聚合器内部 sidechain 字段以控制迁移风险，CLI 不暴露子 Agent 选项，不声称支持区分子 Agent。filesScanned 是候选 rollout 数加 history 路径（即使不存在），不是成功读取数。统计不是成功执行次数。测试只用临时合成日志，不复制真实数据。没有远端、提交、发布或自动归档。

参数预检使用 Node 内置 parseArgs 严格模式，从同一份 command.args 派生参数声明并补入帮助/版本；在进入 Gunshi 与读取日志前拒绝未知参数和位置参数，错误只写 stderr。
数值也在严格预检中验证，确保NaN等非法值不会由框架向stdout输出诊断。
