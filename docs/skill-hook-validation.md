# Skill Hook 验证范围

核查日期：2026-10-30，Asia/Shanghai。当前结论：用户重新信任 Windows 启动修复后，真实采集、日志对应和同轮去重已通过。下文按日期保留此前失败记录。

## 已核对

- 本机 codex-cli 0.165.0-alpha.1.2；以 app-server generate-json-schema 将协议导出到 worktree 的 .local/skill-hook-protocol，不启动模型。
- 官方 Hooks 文档明确 PreToolUse 的 session_id、turn_id、tool_use_id、tool_name、tool_input，Bash 命令由 tool_input.command 提供。
- 官方文档说明非受管 Hook 必须正常审查并信任；Hosted tools 等路径不保证覆盖，不能假设原生 SkillStart。
- 模块测试以合成输入核对字段映射、静态读取识别与缺身份处理；CLI 测试真实启动采集脚本进程，但 stdin 是合成的宿主输入。
- 采集脚本的 JSON 原子留存、静默 stdout、失败返回成功退出码及固定诊断均有隔离测试。工具或技能成功不在该脚本判定范围内。

官方来源：https://learn.chatgpt.com/docs/hooks

## 2026-10-29 尚未完成的项目

未取得当前客户端在正常登录和 Hook 信任后真正触发 PreToolUse 的 stdin 样本。因此不能把字段文档或生成协议当作真实端到端验证，也不能把合成对照结果解释为个人技能覆盖率。

后续真实验证需要在隔离 Codex home/项目中正常登录，按正常流程审查本采集脚本与配置，发起一次最小工具读取。不得绕过 Hook 信任、复制认证或修改个人全局配置。记录客户端版本、原生输入中的最小身份字段、匹配日志行及两个来源的逐项对应，不保留请求/响应正文或认证。

## 优化顺序

1. 先完成真实回调的字段、身份及静态读取路径对照。
2. 再评估 history 中缺 turnId 的记录是否有可验证关联，未取得依据前保持未知。
3. 若实际日志普遍超过 8 MiB，增加有界流式读取，保留同样的错误与覆盖语义。
4. 根据共同组、独有组和未决记录回查原文，区分漏采、误识别和身份冲突，再决定扩展工具路径。

## 2026-10-30 注册后验证

用户随后明确要求注册到个人 Codex，并通过正常流程完成信任。该授权取代前述不修改个人配置的限制；原配置已备份，未绕过或修改信任状态。

- 当前 codex-cli 0.166.0-alpha.5.1；原生 app-server hooks/list 返回用户级 PreToolUse / Bash enabled=true、trusted，没有配置解析错误。
- 固定安装的采集命令以非技能合成输入检查，退出码 0、stdout/stderr 为空，没有产生假采集记录。
- 本聊天读取已配置的技能文件后，usage-skills 仍只有 config.json。
- 使用正常个人配置和既有信任进行原生 CLI 最小读取，Get-Content 读取 readable-tech-answers/SKILL.md 成功，日志含 session/turn/call 身份。实际路径为 custom_tool_call exec，其脚本调用 tools.exec_command。
- 该单会话日志重放为 Logs Explicit 0、Logs Inferred 1、Hooks 0、Unique Total 1，未决 0；生产目录仍无 Hook 证据包。这是日志侧通过、Hook 侧未通过的结果，尚未获得原生回调 stdin。
- 第二次诊断仅临时关闭 code_mode_host，客户端报告 Code Mode 不可用，读取未执行；没有改动持久配置，不能视为直接 shell 路径验证。

诊断脚本与单会话最小证据包在 worktree 的 .local/，未提交个人会话数据。诊断脚本已改为发现当前安装程序，避免 Codex 更新后固定版本路径失效。

安装和信任已验证，真实采集尚未通过。现有证据无法确定断点在回调调度、命令启动还是输入适配，也不能断言客户端不支持 Code Mode Hook。官方文档描述嵌套工具 Hook 行为，也允许特定路径例外。下一步先取得最小回调诊断，再决定修改采集器或 matcher；不要修改去重规则或将日志伪装成 Hook 证据。

## Windows 启动修复与最小诊断

同日进一步复现：原注册命令以带引号的 node.exe 路径开头，在本机配置的 PowerShell 7 中产生 ParserError，退出码 1；相同命令通过 cmd.exe 可以成功。因此早先只用 Node shell:true（Windows 默认 cmd.exe）做的冒烟检查不足以验证宿主兼容性。这证明存在命令兼容问题，尚不能单独证明先前真实回调的唯一断点。

本机 node.exe 路径没有空格或 shell 元字符。修复后保持该可执行文件路径不加引号，其余参数逐项加引号；已在本机 PowerShell 7 与 cmd.exe 验证。路径有空格或特殊字符的环境不能照搬此拼接方式。未宣称 Windows PowerShell 5.1 的 stdin 转发兼容。

增加可选 scripts/skill-hook-launcher.mjs，以 --collector、--config、--home、--diagnostics-dir 启动原采集器。诊断文件位于独立子目录 latest.json，不参与技能证据统计，只保留最近一次调用的阶段、固定工具名类别、身份字段是否存在、已知输入字段名、子进程状态和输出是否非空；不留存命令、原始身份、输入或子进程输出。失败输出固定诊断，保持工具调用不被采集错误阻断。

- started：诊断入口已运行，尚未完成 stdin 解析。
- input-parsed：已解析真实输入，可据字段形状定位适配问题。
- collector-completed：已执行原采集器，结合 stderr 标志和证据文件判断是否留存。
- launcher-failed：入口或输入处理失败，不输出错误原文。

latest.json 不存在时还需结合原生 Hook 状态判断；不能只凭文件缺失认定宿主没有调度。检查脚本以非技能输入写入的诊断必须放在隔离目录，避免冒充真实回调。

新的启动命令是新的 Hook 定义，需通过 Codex 正常重新审查信任；保留旧 trusted_hash，不手工改为新哈希。原采集器和旧安装目录保留，配置修改前备份。真实回调验收仍待重新信任后进行。

## 2026-10-30 重新信任后的通过记录

用户确认重新信任后，原生 hooks/list 返回新定义 trusted。当前聊天真实执行两次 Get-Content，读取同一个 readable-tech-answers/SKILL.md；每次原生 PreToolUse 均生成独立 Hook 证据包。诊断 stage 为 collector-completed，退出码 0，stdout/stderr 均为空。未再提交模型测试请求，也没有把合成输入写入生产记录。

| 能力 | 实测范围与结果 |
| --- | --- |
| 客户端 | Windows，codex-cli 0.166.0-alpha.5.1 |
| 调用路径 | 当前聊天 exec 包装后调用 tools.exec_command，原生回调为 PreToolUse / Bash |
| 输入形状 | tool_input 为 object，含 command；session_id、turn_id、tool_use_id 均存在 |
| 会话和轮次 | Hook 证据身份与日志原生身份一致；不使用时间近似配对 |
| 调用身份 | Hook 为嵌套 exec-* 调用 ID，日志为外层 call_* ID；保留各自来源记录，不强行改成同一原始记录 |
| 技能身份 | 两来源均解析到同一显式映射的 standalone 技能 |
| 成功语义 | 仅证明读取尝试已留存，不证明后续技能执行成功 |

同一会话、轮次、技能的对照：

| 原始日志读取 | 原始 Hook 读取 | Logs Explicit | Logs Inferred | Hooks | Unique Total | 共同组 | 日志独有组 | Hook 独有组 | 未决 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 2 | 0 | 1 | 1 | 1 | 1 | 0 | 0 | 0 |

两份 Hook 包均由真实回调留存，重复读取仍只形成一个技能轮次；将同一输入包重复合并后总计不变。三个模式的同范围可重放报告保存在 .local/verified-live-{logs,hooks,combined}-2026-10-30.json，仅在本机保留。生产包位于用户 Codex home 的 usage-skills/，diagnostics/latest.json 是独立最近回调诊断，不计入技能使用。

失败样本与通过样本的差异为：启动修复前的最小测试只有日志组，修复并重新信任后的同组两来源均存在。它支持本机启动兼容修复有效，不证明所有客户端或其他工具路径都已覆盖。历史身份缺失、映射缺失、超大日志等仍按未知处理，不据此宣称任一来源更全面。

停止采集可在 /hooks 禁用该用户级处理器；恢复后正常启用并核实信任。回退时从用户 home 的 hook-registration-backups/ 选择对应 hooks.json 备份，保留其他 Hook 配置及 usage-skills 数据，恢复后再核实信任。当前固定安装为 d367261-launch-a75e0974；旧采集器安装保留。

后续优先级：先以正常使用产生的更多会话抽查共同、独有和未决组，再决定扩充工具路径和技能映射；全量历史的缺身份项与 8 MiB 日志上限仍是独立待优化项。

## 2026-10-30 全量查询出现全部未知的修复

用户实际查询暴露出单样本验收未覆盖的体验问题：映射只覆盖先前安装状态，最近一天 18 条日志及 2 条 Hook 候选缺 skillKey，影响范围无法限定，严格聚合将相关列和总计全部置空；渲染器又没有展示原因。并非 Hook 未运行，也不是已知零使用。

本次基于真实日志的静态路径，核验存在的普通技能文件并补充 8 项明确映射，原配置已备份；没有将拼写异常或无可靠上下文的相对路径猜配到现有技能。查询时新增同实例、本采集器 v1 路径摘要与显式配置的唯一匹配修复；原 Hook 包未改写，信任定义与运行中的采集器未修改。

实测最近一天：Hook 为 3 skill-turns / 3 skills，原先两条未决均被精确映射；日志未决降到 5，已解析证据有 38 组。相对路径和不存在的拼写路径仍待核对，严格日志总计继续为未知，新增页脚明确说明原因。该统计窗口随当前时间滚动，不是固定验收总量。

验证覆盖：唯一摘要恢复、Windows 分隔符、配置歧义、缺其他身份、不可信 producer、原始文件不变、视图与窗口隔离、三种旧完整样例不变。显式导入报告仍为纯重放；不会读取个人映射后悄悄改变其含义。
