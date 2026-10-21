# Verification — 2026-10-21

## 诊断证据
只读检查用户报告首行：文件为有效 UTF-8，含 BOM，但标题已是“浣跨敤鎶ュ憡”，无替换字符。这与 UTF-8 字节先被错误解码、再编码为 UTF-8 的现象一致；不能根据当前 shell 编码反推生成文件时的环境。未读取或输出实际 Skill 名称，未修改用户报告，也未扫描真实日志。

## 验证结果
- pnpm run test：112/112 通过，类型负例继续编译检查。
- pnpm run typecheck：通过。
- pnpm run test:cli：构建通过，44/44 通过。新增 6 项测试覆盖中文文件路径、正确中文标题、无 BOM、结尾换行、父目录创建、文件覆盖、JSON 和 MCP JSON 可解析、stdout 为空、错误参数与目标为目录的失败退出。
- openspec validate fix-utf8-report-export --strict --no-interactive：通过。
- git diff --check：通过；README 和模块说明已改用 --output 直接保存，文档本地链接检查通过。

## 边界
当前检查环境为 Windows、Node v22.22.2；未重现所有 shell/codepage 组合。新入口直接写文件，避免 shell 原生进程字节转文本步骤。未使用 --output 的既有 stdout 行为不变；有意的 Markdown 实体转义也保持不变。

原乱码文件未尝试逆向修复；用户可使用原有窗口、strict 和数据目录选项重新导出。新文件输出会覆盖用户显式指定的目标文件。没有新依赖、推送、归档或 worktree 删除。
