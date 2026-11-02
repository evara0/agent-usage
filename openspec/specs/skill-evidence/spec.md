# skill-evidence Specification

## Purpose
为 Skill 日志与 Hook 证据提供可追溯的结构化输入、技能轮次归组和独立及合并统计，使自动采集、Codex 整理及人工转录能够按相同规则产生可核对的人读报告，并明确缺失身份、来源冲突和推断的边界。

## Requirements

### Requirement: 可重算的结构化证据报告

系统 SHALL 定义 kind=skill-usage-comparison、schemaVersion=1 的独立契约，包含 mode、countUnit=skill-turn、sourceInstanceId、timeZone、period、generatedAt、deduplication、evidence、skills 和 totals，并支持可选 countPolicy=resolved|strict。旧包省略该字段时 MUST 按 strict 校验；日常本机查询默认 resolved，重放已声明策略的报告时尊重声明，允许用户明确切换。系统 MUST 按声明策略从证据重新计算并核对派生汇总，不把提交的汇总当作去重依据。

#### Scenario: 汇总与证据不一致
- **WHEN** 导入的 skills 或 totals 与同批证据按指定规则计算出的结果不同
- **THEN** 导入返回可定位的汇总不一致错误，且不写入本批有效数据

#### Scenario: 自动与人工整理使用同一协议
- **WHEN** 脚本、Codex 或人工转录同一日志或 Hook 记录
- **THEN** method 保留原证据来源，整理方式可另存 producer 元信息
- **AND** 没有原始依据的人工声明进入待核对集合，不伪造 logs 或 hooks 的观测事实

#### Scenario: 证据包省略派生字段
- **WHEN** 结构化输入同时省略 skills 和 totals
- **THEN** 系统从证据生成这两个派生部分
- **AND** 仅提供其中一个派生部分时拒绝输入，已提供完整派生部分时先按包内模式和窗口核对再执行新的查询

### Requirement: 证据身份与来源实例

系统 SHALL 为每条证据保存 method、sourceRecordId、sessionId、turnId、skillKey、type 和 occurredAt，并以 sourceInstanceId 区分数据实例。同实例日志与 Hook MUST 共享实例身份；sourceRecordId MUST 有可复核的原生身份或稳定定位依据，不按每次导入随机生成。显示名称不构成唯一技能身份。

#### Scenario: 重放和跨实例同名
- **WHEN** 同实例同来源同会话同 sourceRecordId 的同内容证据重复导入
- **THEN** 证据只保留一份且不增加统计
- **AND** 不同实例、会话或不同 skillKey 的记录保持独立

#### Scenario: 原生标识缺失
- **WHEN** 不能从原始证据确定轮次或稳定技能身份
- **THEN** 记录及原因进入 deduplication.unresolvedEvidence
- **AND** 不使用时间接近、文件修改时间、当前技能目录或随机 ID 填补共同身份

### Requirement: 冲突和格式校验

系统 SHALL 校验版本、枚举、必要字段、合法 ISO 时间、时区、范围和有限非负整数计数，并对相同证据身份下的内容冲突保存候选与原因。格式错误 MUST 在写入前按批次拒绝；身份缺失或语义冲突 MUST 可追查，不静默覆盖未知结果。

#### Scenario: 同身份冲突
- **WHEN** 同一证据身份的候选具有不同轮次、技能、类型或发生时间
- **THEN** 候选保持待核对，受影响统计不输出伪精确数值
- **AND** 不因文件顺序、最后写入或来源优先级选择一个候选

#### Scenario: 无效时间和未知版本
- **WHEN** 时间无效、period.end 不晚于 start，或版本及 method 不受支持
- **THEN** 返回可定位的错误并不写入本批数据

### Requirement: 技能轮次归组与跨来源并集

系统 SHALL 以 sourceInstanceId、sessionId、turnId、skillKey 的联合身份归组。同来源同组多条证据最多计一次；日志组内 skill_requested 或 skill_injected 优先计 logsExplicit，否则 skill_read_attempt 计 logsInferred。hooks 为具有合格 Hook 证据的组数，uniqueTotal 为所选来源的组并集。系统 MUST 保留各来源证据。

#### Scenario: 相同轮次不同事实
- **WHEN** 同轮同技能既有日志指定证据，又有 Hook 读取尝试
- **THEN** logsExplicit 为 1、logsInferred 为 0、hooks 为 1、uniqueTotal 为 1
- **AND** 两条不同事实的证据均保留，不声称它们是同一个原生事件

#### Scenario: 合成双来源对照
- **WHEN** 样本含 2 个日志明确组、3 个日志推断组、4 个 Hook 组，两个来源共有 3 个组
- **THEN** combined 显示 2、3、4、6
- **AND** logs 显示 2、3、null、5，hooks 显示 null、null、4、4

#### Scenario: 多轮和独立会话
- **WHEN** 同技能在两个不同轮次使用，或两个独立会话在同一秒出现证据
- **THEN** 分别计数，不按整会话压缩或全局技能加秒误合并

### Requirement: 未决身份与未知汇总

系统 SHALL 保留 deduplication.ruleVersion、keyFields 与 unresolvedEvidence，后者包含原候选、原因和影响范围。strict 策略下不能可靠确定的分项或 uniqueTotal MUST 为 null；受影响总计对应字段也为 null，已确认不受影响的分项继续提供。resolved 策略 SHALL 只对身份完整的被接受证据归组，并在 JSON 声明策略、表格标注计数依据、单列当前范围的未决候选；不得把该视图称为包括未决记录的完整总数。系统 MUST 不丢弃未决明细。

#### Scenario: 无法判断是否重复
- **WHEN** strict 策略下新证据缺少 turnId，可能属于已有组也可能属于新组
- **THEN** 不自动合并或增加一个新组，受影响的 uniqueTotal 为 null
- **AND** 修复身份后可按同一原始证据重新计算

#### Scenario: 日常统计显示已解析证据并保留未决
- **WHEN** 完整身份的日志证据形成 3 个技能轮次，另有 1 条缺技能身份的候选
- **THEN** 默认 resolved 策略显示 3，并在页脚提示未决候选 1；JSON 保留候选且声明 countPolicy=resolved
- **AND** 用户切换 strict 时受影响完整计数为 null，两个策略的报告均能按原声明重算核对

#### Scenario: 相对路径有原始工作目录
- **WHEN** 日志的技能读取操作数是相对路径，原始 session/turn cwd 或该工具静态 workdir 可验证
- **THEN** 系统按原始目录解析绝对路径并查显式映射，工具 workdir 优先，不执行命令
- **AND** 动态目录、缺少目录和驱动器相对路径不使用查询进程的目录补齐

#### Scenario: 严格计数未知的展示与明确映射修复
- **WHEN** 所选来源和时间范围内有未决候选，或本地原生 Hook 包缺 skillKey 但存在采集器 v1 留存的路径摘要
- **THEN** strict 视图保留未知计数并说明已解析证据组数，resolved 视图显示已解析统计；两者均提示未决候选及缺失字段，不冒充包含未决的完整总数
- **AND** 仅同实例、本采集器原生包的路径摘要与显式配置路径唯一匹配时修复查询投影，不修改原始包；歧义、其他 producer 和缺其他必要身份继续待核对
- **AND** 未选来源和窗口外未决项不触发提示，显式证据包重放不依赖个人映射

### Requirement: 受支持的日志与 Hook 采集边界

日志入口 SHALL 从受支持会话、归档日志及用户输入历史提取证据，不执行日志代码。Hook 入口 SHALL 仅从实测支持的宿主事件生成 Skill 证据，并使用本地结构化导出；不得假定存在 SkillStart 事件或把 Hook 处理器成功视为技能成功。系统 MUST 保留读取尝试的证据属性。

#### Scenario: 读取失败与宿主注入
- **WHEN** 工具记录包含 SKILL.md 读取尝试但结果失败，或宿主通过注入使用技能而不读取文件
- **THEN** 前者仍只表示读取尝试，后者由可用的注入证据表示
- **AND** Hook 没有观测到后一条不能证明技能没有使用

#### Scenario: Hook 采集器故障
- **WHEN** 本地采集写入失败或碰到未支持事件
- **THEN** 记录可用诊断，不阻断受监控操作，不执行配置中额外命令或向外发送数据
- **AND** 对外输出不宣称已取得完整历史

### Requirement: 三种视图与英文表格

系统 SHALL 在 logs、hooks、combined 模式统一显示 Skill、Logs Explicit、Logs Inferred、Hooks、Unique Total、Last Recorded，列名保持空格与大小写。未选择来源的列及无法确定的值显示 —，已检查结果为零显示 0；主表 MUST 不自动附加未覆盖解释或采集时段。

#### Scenario: 单来源视图
- **WHEN** mode 为 logs 或 hooks
- **THEN** 未选来源的列为 null 并显示 —，其证据不参与当前视图计数与最近时间
- **AND** 页脚使用去重后的技能轮次记录总数及技能数，不称为执行次数

#### Scenario: 日期时间与窗口
- **WHEN** 报告声明合法 timeZone 和 period
- **THEN** 按包含 start、不包含 end 的发生时间过滤证据
- **AND** Last Recorded 为当前选中且在窗口内有效证据的最晚 occurredAt，按 timeZone 显示 YYYY-MM-DD HH:mm

#### Scenario: 全历史和重新选择来源
- **WHEN** period.start 和 end 均为 null，或对同一证据包选择另一个 mode
- **THEN** 全历史不做时间截断，仅一个时间边界为 null 时拒绝输入
- **AND** 模式只影响当前派生视图，结构化留存不删除未选来源的原始证据

#### Scenario: limit 与空结果
- **WHEN** 使用表格 limit 或当前窗口无有效证据
- **THEN** limit 不改变完整 JSON 与汇总，空结果 skills 为空且已启用来源总计为 0
- **AND** 不把 generatedAt 或采集导入时间填为 Last Recorded

### Requirement: 最小留存与查询重放

系统 SHALL 保存被接受的最小证据及待核对项，以本地导出或导入文件作为可重放来源，并按证据身份防止跨批重复；统计过滤和模式选择不得改写原证据。系统 MUST 不默认保存命令全文、结果正文、凭据或全量会话内容。

#### Scenario: 重复导入后重算
- **WHEN** 同一导出导入两次，随后切换来源或统计窗口
- **THEN** 仍能得到与单次导入相同的组数，各视图只改变派生报告
- **AND** 错误不得回显不必要的原始内容或秘密字段
