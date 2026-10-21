## Context

以 docs/skill-provenance-research.md 的结论为依据。现有 InvocationEvent 不含安装身份/版本，名称归一化和聚合已丢失部分消歧信息。本期只增加当前资料候选，保留现有行为。

## Goals / Non-Goals

Goals：离线、有界、只读；声明逐字段解释；对同名、别名、版本共存和未知保持诚实；用户无需修改全局 Skill 即可注册来源声明。

Non-Goals：可信发行认证、联网验证、完整 YAML 解析、历史归属与作者计数、扫描所有插件缓存或资产。

## Decisions

### 1. 显式输入和有界发现

--provenance 默认扫描所选 Codex home 的 skills 根；--skill-root 替换该根。仅读一层子目录及 .system 的一层；--plugin-root 指向一个完整插件版本目录，只读 root plugin.json 或 .codex-plugin/plugin.json 与 skills 的一层。禁止跟随符号链接和任意清单路径。每根最多检查 256 个目录项，最多 256 个候选；每个元数据文件最多 64 KiB；映射最多 256 项。超限/缺失/无权限/不支持格式只计质量诊断或 unknown，不回显路径。映射错误为整次失败，发生在日志扫描前。

Skill front matter 仅支持无歧义的单行 name/license 与两空格缩进 metadata.author 标量子集；复杂 YAML 不猜测对应字段，不执行内容。插件根若存在 portable manifest，仅接受已知 portable schema；其身份优先，不能将 overlay 拼成混合身份。兼容格式只接受 ./skills/ 路径；不支持的组件路径明确计诊断。

### 2. 身份与时间边界

本地身份不含绝对路径：standalone:<相对目录>；插件身份为 plugin:<包名>@<版本或 unknown>:skills/<相对目录>。插件名、Skill 名与版本使用限定字符集。它们是本次输入范围内的定位符，不是认证身份或跨机器安装 ID。一个运行仅接受一个 standalone 根和一个插件版本根，未来多根需另行设计稳定根身份。

插件候选只自动接受 plugin:skill 全命名空间；standalone 同时保留目录名和 front matter 名。注册项可显式增加别名。多个候选、部分别名未解析、同名目录及版本别名不静默合并；归一化统计仍原样保留，旁路列出 candidateIds 和 unresolvedAliases。全部原始别名唯一命中同一身份才标 candidate，仍非历史确认。

### 3. 字段与证据

publisher、originalAuthors、distribution、acquisition、license、localState 分开存为 claim。每项保留 value 与 evidence（file_declared=E3，user_declared=U）；没有证据 status=unknown，多种不一致值 status=conflict，同值可保留不同证据。多个原作者在同一数组表示协作，不视为冲突。包 author 只进 publisher，Skill metadata.author 才可作为声明原作者。本期不产生 E1/E2，不从路径/.system/名称/URL 产生官方、原创或开源分类；license 仅声明值，不判断开源适用性。

### 4. 映射

JSON 格式 version=1，entries 数组。每项 installationId 精确选择发现身份；或使用 registered:<用户标识> 建立仅用户注册、未证明已安装的资料。aliases 为精确原始名称，不按规范化短名称隐式扩展。字段可选，严格校验类型、枚举、长度、未知键、重复 selector 和敏感显示值；整体错误拒绝。未命中的非 registered selector 计 unmatchedMappings，不凭空造安装实例。文件与用户冲突并列，不 override 成核验事实。

### 5. 输出与兼容

SkillUsageReport 仅新增可选 provenance，含独立 schemaVersion=1、observedAt、temporalScope=current_reference_only、inventory、associations 与数值 diagnostics。不会往原 skills、source、sources 中塞作者，使用计数不变。--provenance-map/--skill-root/--plugin-root 要求 --provenance，且 provenance 不能与 --mcp 组合。默认输出无新增字段。JSON 与 Markdown 完整，表格 provenance 区遵循 limit，不按作者或来源重分配调用次数。

### 6. 隐私与离线

模块不引入网络 API、Git 子进程、遥测或本地写入。输出不含原始路径/目录错误/仓库 URL/邮箱；只接收单行受限显示名，删除终端控制风险。仓库字段不采集，避免泄漏私有地址或凭据；此版本不能输出上游版本链。现有使用报告仍有 projects 等个人信息，文档明确新模块不为旧字段提供脱敏保证。

## Risks / Trade-offs

受限 YAML 不覆盖所有合法 Skill，宁可 unknown；缓存/包目录存在不代表启用；手工映射由用户维护。没有完整包摘要或可信回执，所有自动归属都是声明，E1/E2 与历史快照另期实现。观察 ID 非全局持久身份，不能用于跨根合并。

## Migration Plan

保持默认模式完全兼容；新开关增补字段，schemaVersion=1 不变。回退时去掉开关即可，不迁移原始日志/全局安装。完成后同步新增 capability 主规范，保留活动 change，不归档。

## Validation

使用临时合成目录/日志/映射测试所有证据状态、身份歧义、历史边界、敏感字段与链接限制、只读快照及三种输出。顺序运行模块、类型、CLI、OpenSpec 与 diff 检查；不读取真实使用日志。
