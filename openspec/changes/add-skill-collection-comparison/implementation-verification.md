# 离线实施验证记录

日期：2026-10-29；工作树 codex/skill-collection-contract，基线 a7f2a09。本次用户授权实施，随后明确选择“本次先完成离线交付，真实验证后续进行”。

## 已交付

- --skill-method logs|hooks|combined 与 --skill-evidence；原默认命令及 --hooks 处理器统计保持兼容。
- skill-usage-comparison v1 类型、JSON Schema、普通 UTF-8 文件和大小/链接边界校验。
- 原始日志信号的独立新适配路径、显式实例/技能映射、本地 Hook 采集命令。
- 两层去重、冲突隔离、待核对影响传播、时间窗口和时区、完整证据导出/重放、逐组来源对照。
- 三种英文表格、固定快照、可独立使用的 docs/examples 合成数据、整理指令与启停/回退文档。
- Hook 命令已实现本地原子 JSON 留存，异常不输出决策且保持成功退出；未在真实客户端安装或启用。

## 已执行检查

- pnpm install --offline --frozen-lockfile：使用缓存安装开发依赖，无下载、无依赖版本变更。
- pnpm run test：170 项模块回归通过，0 失败。
- pnpm run typecheck：通过。
- pnpm run test:cli：71 项 CLI 回归通过，0 失败；其中真实子进程执行 Hook 脚本，但 stdin 与日志均为合成数据。
- openspec validate --all --strict --no-interactive：10 项通过（本变更及现有 9 个规范）。
- openspec validate --archived --strict --no-interactive：10 项历史归档检查通过。
- JSON Schema 文件已生成；三份示例经过本实现运行时重算和字段校验。尝试使用捆绑 Python 作独立 Draft202012 元校验时，因未安装 jsonschema 库而未执行；没有新增该依赖，也不声称独立元校验通过。
- 最终提交前运行 git diff --cached --check，以覆盖新加入文件的空白检查。

关键结果：同一组 9 条证据得到日志 2/3/null/5、Hook null/null/4/4、合并 2/3/4/6；已知共同组 3、日志独有 2、Hook 独有 1。另一个隔离用例实际运行采集脚本并生成文件，再与合成日志合并，得到日志推断 1、Hook 1、并集 1。

## 尚未完成的真实验证

任务 4.1、4.3、5.2 保留未勾选：已有文档和本机协议核对、启停文档与合成对照，但尚无当前客户端正常登录和信任后触发 PreToolUse 的原生 stdin 证据，也没有个人真实日志与 Hook 的同范围对照。其余 16 项离线任务已完成。

本机版本为 codex-cli 0.165.0-alpha.1.2。导出 app-server 协议没有启动模型。PreToolUse 字段据官方 Hooks 文档核对；这不等于真实触发验证。

## 当前限制与下一步

- 自身日志没有可验证 turnId、历史记录只有时间或技能映射不唯一时，结果进入待核对，相关统计为空值，不自动按时间补齐。
- 不同实例包拒绝拼接，须分别查询；同一实例两采集器需明确共享配置。
- 单个日志/证据文件限制为 8 MiB；输入/查询最多 10,000 条候选。过大或损坏原始日志可能导致未知总计，尚未实现有界流式大文件解析。
- Hook 当前只采集可静态识别的文件读取尝试；回调收到时间是本地观测近似值，不代表原生工具精确起点或技能成功时间。
- 下一步按用户意愿完成隔离登录、正常信任和一次最小原生回调验证，再按共同/独有/未决组抽查覆盖情况。
- 本次不合并、推送、归档或修改个人全局配置；变更保留在独立工作树。

## 2026-10-30 后续真实验证

用户在离线交付之后要求注册到个人 Codex，并自行完成正常信任；用户级配置已备份安装。当前 0.166.0-alpha.5.1 的原生 hooks/list 确认 PreToolUse / Bash 已启用且 trusted，安装命令的无记录合成检查通过。

真实 CLI 最小技能读取成功，但没有生成 Hook JSON。该单会话日志可重放为 0/1/0/1（Logs Explicit / Logs Inferred / Hooks / Unique Total），未决 0。调用经过 exec 包装到 tools.exec_command；临时关闭 code_mode_host 的第二次诊断因宿主不可用未执行读取，没有修改持久配置。真实回调验收未通过，4.1、4.3、5.2 继续保持未完成。

全量扫描包含历史未决证据，完整总计仍未知。单会话证据包与诊断脚本保存在忽略目录 .local/，不提交个人数据。下一步定位回调断点，详情见 docs/skill-hook-validation.md 的同日记录。

### Windows 启动兼容修复

发现原注册命令在 PowerShell 7 中产生 ParserError，而先前只通过 cmd.exe 的冒烟检查未能发现问题。修复本机无空格 Node 路径的命令拼接，并增加独立的 scripts/skill-hook-launcher.mjs 诊断入口；原采集器实现与去重规则未改动。诊断仅记录阶段、字段形状及子进程状态，不保存原始命令、ID 或子进程输出。

已执行：typecheck 通过；73 项 CLI 测试通过，含实际 PowerShell 7/cmd 启动与失败诊断；OpenSpec --all --strict 校验 10 项通过；git diff --check 通过。修改后的用户级定义已备份注册，原生状态为 modified，需要用户正常重新信任后再做真实验证。安装检查的诊断输出放在隔离目录，没有写入生产回调诊断或伪造 Hook 证据。真实任务继续保持未勾选。

### 重新信任后完成验收

用户再次确认信任，原生状态为 trusted。当前聊天同轮执行两次同技能文件读取，取得两份真实 Hook 包；真实回调具备 session/turn/tool-use 身份、Bash 工具名和 command 输入。与同范围两条原始日志按 session/turn/skill 精确归组后，得到 Logs Explicit 0、Logs Inferred 1、Hooks 1、Unique Total 1；共同组 1、独有组 0/0、未决 0。重复合并同包，统计保持不变。

当前成功验证不需要额外模型请求；诊断与采集均来自本聊天的原生工具回调。外层日志 call_* 与嵌套 Hook exec-* 原始身份不同，按各自来源保留，由第二层技能轮次键去重。证据包与三个模式的报告在 .local/verified-live-*-2026-10-30.json，本地保留不提交。能力矩阵、失败前后差异、停止及回退说明见 docs/skill-hook-validation.md。

4.1、4.3、5.2 在该授权范围内完成，19 项任务全部通过；此前延后及失败结论保留为历史。未认证其他客户端、其他工具路径或完整个人历史覆盖率。
