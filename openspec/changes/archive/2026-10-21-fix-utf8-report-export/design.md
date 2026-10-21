# Design

## Context
本机 .local/skill-usage.md 的 UTF-8 首行解码后已包含乱码，文件同时有 BOM。渲染器源码为正常中文。shell 的原生进程输出解码及随后编码是独立环节，最后使用 UTF-8 保存不能纠正前一步的错误。当前 shell 编码不一定代表用户生成文件时的 shell 状态。

## Decisions
1. 新增字符串 --output PATH，仅与 --markdown/--json 使用；表格加 --output 在严格预检时拒绝，缺值继续由 parseArgs 拒绝。已有互斥规则保持不变。
2. src/output.ts 统一输出：未指定文件时保持 console.log；指定文件时使用 Node fs.mkdir 递归建立父目录，fs.writeFile 直接写无 BOM UTF-8，以换行结束，不经 PowerShell 管道。目标文件已存在时覆盖，README 明确说明；stdout 为空且无 CLI 横幅。
3. 写入失败在 stderr 报告，退出码非零，避免框架把错误写到 stdout。--help 仍正常显示帮助。
4. 不在本轮尝试逆向恢复已损坏内容或重新扫描用户日志。建议用户在相同统计窗口和选项下重新导出。

## Validation
使用合成日志验证含空格与中文的输出路径、中文 Markdown 首行、无 BOM 字节、父目录创建、覆盖、JSON 可解析、MCP JSON、空 stdout、错误模式和目录目标写入失败；运行全部项目检查及严格 OpenSpec 校验。
