# Skill Hook 验证范围

核查日期：2026-10-29，Asia/Shanghai。

## 已核对

- 本机 codex-cli 0.165.0-alpha.1.2；以 app-server generate-json-schema 将协议导出到 worktree 的 .local/skill-hook-protocol，不启动模型。
- 官方 Hooks 文档明确 PreToolUse 的 session_id、turn_id、tool_use_id、tool_name、tool_input，Bash 命令由 tool_input.command 提供。
- 官方文档说明非受管 Hook 必须正常审查并信任；Hosted tools 等路径不保证覆盖，不能假设原生 SkillStart。
- 模块测试以合成输入核对字段映射、静态读取识别与缺身份处理；CLI 测试真实启动采集脚本进程，但 stdin 是合成的宿主输入。
- 采集脚本的 JSON 原子留存、静默 stdout、失败返回成功退出码及固定诊断均有隔离测试。工具或技能成功不在该脚本判定范围内。

官方来源：https://learn.chatgpt.com/docs/hooks

## 尚未完成

未取得当前客户端在正常登录和 Hook 信任后真正触发 PreToolUse 的 stdin 样本。因此不能把字段文档或生成协议当作真实端到端验证，也不能把合成对照结果解释为个人技能覆盖率。

后续真实验证需要在隔离 Codex home/项目中正常登录，按正常流程审查本采集脚本与配置，发起一次最小工具读取。不得绕过 Hook 信任、复制认证或修改个人全局配置。记录客户端版本、原生输入中的最小身份字段、匹配日志行及两个来源的逐项对应，不保留请求/响应正文或认证。

## 优化顺序

1. 先完成真实回调的字段、身份及静态读取路径对照。
2. 再评估 history 中缺 turnId 的记录是否有可验证关联，未取得依据前保持未知。
3. 若实际日志普遍超过 8 MiB，增加有界流式读取，保留同样的错误与覆盖语义。
4. 根据共同组、独有组和未决记录回查原文，区分漏采、误识别和身份冲突，再决定扩展工具路径。
