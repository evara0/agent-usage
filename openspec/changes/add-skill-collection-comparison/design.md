# Design

## Context

动机见 [proposal.md](proposal.md)。当前基线为 a7f2a09：Skill 日志采集、MCP、Hook 处理器离线导入和来源资料各自独立。Skill 事件缺少 turnId、稳定源记录 ID 和技能身份；现有聚合按秒或整会话压缩，不能直接复用到技能轮次统计。现有 --hooks 接受 hook/started 与 hook/completed 的处理器摘要，不能反推当前技能。

初始交付仅创建规划和样例；2026-10-29 用户授权实施并先完成离线交付，后续明确要求注册到个人 Codex 并正常信任。2026-10-30 已完成本机最小真实回调与同轮去重验证，实施与验证见 implementation-verification.md。

## Goals / Non-Goals

**Goals:**
- 先固定用户已确认的英文输出，再落实逐条证据和可重算口径。
- 两来源独立统计后进行并集与逐项对照，支持 Codex 或人工按规范转录原始事实。
- 缺身份、冲突和不支持路径有可检验结果，不制造调用、轮次或成功状态。
- 按用户后续确认，日常显示身份完整证据统计并单列未决，保留严格模式；使其他使用者能自行初始化、刷新和注册，不依赖开发者个人映射。

**Non-Goals:**
- 首次离线交付不启用真实 Hook；后续按用户明确注册授权完成个人配置备份、安装、正常信任和最小验证，不绕过信任或扩大为全历史完整性认证。
- 不建设数据库或实时面板，不声称捕获所有技能路径或技能执行成功。
- 不修改旧默认命令与 SkillUsageReport v1，不把 Hook 处理器统计并入 Skill 使用统计。

## Decisions

### 后续确认：日常口径与可移植接入

用户实际查询暴露出严格模式使未知技能影响全表的问题。2026-10-30 用户明确选择“已确认统计＋未决提示”：新查询默认 countPolicy=resolved，严格模式由 --skill-counts strict 选择；原始未决不删除，旧包省略策略时仍按 strict 校验。JSON 声明口径，表格标注计数依据，不把已解析视图冒充完整总量。

日志解析保留静态工具工作目录，以原始 session/turn cwd 解相对路径；动态目录和驱动器相对路径不猜配。正式 setup/skills refresh 负责本机发现与更新，独立 sidecar 保存范围以保持旧采集器配置兼容。hooks install 明确修改用户配置、固定安装并生成平台启动命令，保留其他 Hook；正常信任仍由用户完成。原日志问题与初始化共享身份规则，因此先在当前分支修复日志，再完成接入验收，避免先合并已知不可用的查询。

### 1. 输出与旧契约隔离

新增 --skill-method logs|hooks|combined；不传参数继续原默认统计。增加 --skill-evidence PATH 用于只读导入单个结构化 JSON 文件，必须配合新模式。原 --hooks 含义保持。新模式先支持 JSON 与英文表格，沿用 days、limit、codex-dir 和 output，暂不叠加 provenance、strict 或 Markdown。

新报告由 kind=skill-usage-comparison 与 schemaVersion=1 联合识别，不冒充旧 SkillUsageReport。替代方案是在默认报告内改变 total 含义，会破坏既有规范与消费者，因此不采用。

固定主表为：

```text
Skill       Logs Explicit   Logs Inferred   Hooks   Unique Total   Last Recorded
handoff                 2               3       4              6   2026-10-28 18:35
```

头部显示日期或范围及 Mode；正文不增加采集时段、未覆盖说明。0 与 null 分别显示 0 与 —。页脚用 `6 skill-turns · 1 skill`，避免把技能轮次之和称为独立对话轮次。完整样例见 [examples/report-examples.md](examples/report-examples.md)。诊断与未决明细保留在 JSON，不因简化表格而删除。

### 2. 同技能轮次有共同身份，证据仍分别保留

归组键为 JSON 序列化的 `[sourceInstanceId, sessionId, turnId, skillKey]`，不能用带分隔符的字符串拼接造成碰撞。同一轮可使用多技能；同技能不同轮分别计数。

- sourceInstanceId 是由用户或本地采集配置确认的数据实例标识，不等于某个适配器的进程 ID。日志与 Hook 明确共享同一数据实例才配置相同值；不同设备的副本不能只因名称相同自动合并。
- sessionId、turnId 优先使用原始宿主身份。只有日志边界和可核对关联确实能确定轮次时才恢复 turnId，缺失或歧义保留未决。
- skillKey 代表该实例和作用范围内稳定且可复核的技能身份，例如经明确映射确认的 standalone:handoff；展示名和去版本号结果不能自动当身份。路径或插件名无法消歧时进入未决。
- 证据类型首先限定 skill_requested、skill_injected、skill_read_attempt。读取失败仍属于尝试；指定和读取属于不同事实，归为同一个技能轮次不表示两个原生事件相同。

不采用全局技能名加秒、120 秒合并、300 秒回声或整会话抑制规则。若确需恢复/分叉关联，必须增加可验证原生关联，不能借用旧时间窗口猜测。

### 3. 两层去重和冲突处理

第一层证据身份为 `[sourceInstanceId, method, sessionId, sourceRecordId]`。原生消息/调用 ID 与阶段可作为 sourceRecordId；缺少原生 ID 时使用稳定原文定位或内容摘要，并保留核对依据。相同身份相同最小投影只保留一份；相同身份不同内容保留全部候选，受影响项进入未决。不能用每次导入生成的 UUID 达到表面唯一。

第二层按技能轮次归组：
- logsExplicit 为日志中包含 requested 或 injected 的组数。
- logsInferred 为日志中仅有读取尝试的其余组数；与前项互斥。
- hooks 为包含合格 Hook Skill 证据的组数，不等于原始 Hook 通知数。
- uniqueTotal 为选中来源组集合的并集，不是三个分项之和。

因此 2 个明确日志组、3 个推断日志组、4 个 Hook 组，共有 3 个组时，并集为 6。相同调用的前后事件可以分别保存，但同轮同技能只增加一个组。

缺身份和冲突存入 `deduplication.unresolvedEvidence`，元素含 `evidence` 候选数组、`reason`、`affectedSkillKeys`（null 表示无法限定）和 `affectedMethods`。禁止把这些证据重新放入已接受 evidence 参与计数。任何可能改变某项统计的未决项使对应值为 null；总计对应项同样为 null。完全不受影响的分项保留数值。去重规则版本不受支持时拒绝导入，不静默换用新规则。

### 4. 汇总是派生结果，结构化输入可以重算

完整报告保留前文确认的 period、generatedAt、timeZone、evidence、skills、totals 和 deduplication。明细 method 仅表示 logs 或 hooks；可选 producer 保存整理工具名、版本和 automated/agent-assisted/manual，不用编辑者身份冒充原事件来源。

导入支持相同契约的证据包：可以同时省略派生 skills 和 totals，交由系统计算；提供任一派生部分时必须成对提供，并在输入自带 mode、period 和 ruleVersion 下重算核对。随后再按 CLI 查询模式或 days 产生新视图。原始导出保留所有已提供来源的最小证据，切换 mode 只改变派生视图，不把未选来源从存储中删除。无原始观测依据的人工声明进入未决，不能生成确定的日志或 Hook 次数。

计数均为有限非负安全整数或 null，字段不允许混入字符串。校验时间真实有效、含时区偏移和可规范化；period.start/end 为合法 ISO 时间且 end 晚于 start，按发生时间包含 start、不包含 end。--days 运行时解析为明确的 start/end；全历史使用 start=end=null，二者必须成对为空。发生时间不等于 observedAt/导入时间。generatedAt 只表示本次报告生成。

Last Recorded 从当前选中来源、窗口内有效证据的 occurredAt 取最大值，并按 timeZone 输出 YYYY-MM-DD HH:mm；采集程序写文件、批次生成或文件 mtime 不能刷新它。未决记录保留原时间，但不补造可计数轮次。totals 为完整 skills 的对应汇总；有受影响的未知分项则对应总计为 null，limit 不参与汇总计算。skills 按 uniqueTotal 降序，null 排在已知值之后，再按 skillKey 稳定排序。

### 5. 两入口分阶段取数

日志：复用现有安全静态解析，提取原始消息/调用和可验证轮次关联，保留最低必要身份。新的日志适配路径必须从旧聚合之前的信号构造，不能从旧 totals 恢复已被压缩的轮次。

Hook：先隔离验证当前客户端的工具事件、session/turn/call 字段、工具路径覆盖及结果关联。没有专用技能事件不构造 SkillStart；从工具读取识别的记录只标 skill_read_attempt。宿主注入无对应 Hook 信号时保持事实边界，主表显示 — 的列不追加解释。

本地留存使用所选 Codex home 下 `usage-skills/` 的显式结构化 JSON 证据包（项目约定，非 Codex 原生目录）。采集器按批写临时文件后原子更名，避免读到半文件；CLI 只读这些文件并重算，不自动安装或启动采集器。离线 --skill-evidence 文件同样可单独重放。跨文件、跨批次及与日志重叠的记录进入同一去重器；不需要新增数据库。全量报告用于对照与导出，输入证据包不必维护中途易过期的汇总。

采集器使用官方文档列出的本地事件格式（真实触发待核对），限定输出最小身份和证据字段，不记录命令/结果全文。采集失败不阻断用户的工具操作；可记录写入故障，但不据此保证没有丢事件。真实配置和宿主验证均是后续实施步骤，不包含在此次规划授权中。

### 6. 兼容与最小安全边界

原 source=codex 字段及现有来源资料含义不变，新契约由 kind 识别，展示采集方式用 mode。输入/留存只读普通 UTF-8 文件，拒绝跟随符号链接，限制文件 8 MiB、每批 10,000 条证据、单 ID 512 字符和未决候选数；超限明确报错，不静默截断后给出完整统计外观。错误提供字段/记录定位而不回显整条原文或私人路径。该边界可后续版本化调整。

## Risks / Trade-offs

- [当前宿主字段不全] → 缺身份进入未决，先完成离线合成验收，再做隔离实测；不承诺 Hook 路径全覆盖。
- [轮次口径隐藏同轮多次实际调用] → 固定 countUnit=skill-turn，保留原始证据；真正执行实例须另议新规则版本。
- [同技能身份映射不稳定] → 需要明确本地映射与证据，不因同名自动合并；独立实例默认隔离。
- [日志和 Hook 两边数量有差异] → 用共同键逐项列出匹配、独有、未决，不以更大的数作为真实性证明。
- [结构化输入含冲突或敏感内容] → 按批格式校验、保留最小投影、冲突候选可追查；不执行包内代码。
- [输入的实例或轮次标识是伪造声明] → 格式校验不能认证真实性，采集与人工转录保留 producer 和证据定位，抽样回到原文。

## Migration Plan

1. 确认本变更中的报告样例、计数与 JSON 契约，当前阶段仅完成规划。
2. 后续实现独立类型/校验和示例，再实现日志路径与 Hook 证据离线导入，分别输出两种结果。
3. 在各来源结果可独立核对后实现并集与持久重放，验证重复导入、冲突、漏采和边界。
4. 对 Hook 支持能力完成隔离验证后，按明确授权启用本地采集脚本；随后根据对照证据优化覆盖。
5. 默认旧命令维持不变；回退时去掉 --skill-method 或停止新采集器，保留已导出证据及旧日志。

## Open Questions

- 当前客户端可提供哪些可验证的 Hook 轮次/调用字段与工具路径？这属于任务中的能力实测，不影响缺字段即未决的协议与离线交付。
- 哪些实际技能身份需要用户显式映射？按遇到的冲突补充映射，不把目录扫描结果自动认证为历史身份。
