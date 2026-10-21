## Why
用户按 README 的 PowerShell 管道方式保存报告后，文件为有效 UTF-8，但标题“使用报告”已变成“浣跨敤鎶ュ憡”。这说明写文件前的字符解码已经损坏，仅指定 Set-Content 的输出编码不足以保证正确。需要不经过 shell 文本解码的直接导出入口。

## What Changes
- 增加 --output PATH，将 Markdown 或 JSON 直接以无 BOM UTF-8 写入文件，按需创建父目录。
- 仅允许与 --markdown 或 --json 配合；支持 MCP JSON，默认终端输出行为不变。
- 更新导出示例、维护卡，并以合成数据验证中文字节与写入失败行为。

## Capabilities
### New Capabilities
- `report-file-export`: 跨 shell 的 UTF-8 文档导出。

## Impact
修改 CLI、导出辅助模块、合成测试、README 和维护说明；无新增依赖。不读取或覆盖用户已损坏的报告，不修改原始日志，不推送或归档。
