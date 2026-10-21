## Why

已有 Skill 使用统计缺少来源上下文。来源调研已提交为 a13ae7b，确认发行方、作者、获取途径、许可证与本地改写不可合为四选一类型，当前目录也不能证明历史调用归属。用户已授权在本 worktree 新建变更并实施渐进最小版本。

## What Changes

- 新增显式 --provenance 开关及可选 --skill-root、--plugin-root、--provenance-map 输入，离线只读发现有限元数据。
- 为 Skill 报告增补独立可选 provenance 字段，含当前观察、声明证据、unknown/conflict 与名称关联歧义；表格和 Markdown 可展示同一资料。
- 用户映射采用版本化 JSON 和严格运行时校验，声明与文件证据并列。默认不联网，不修改全局 Skill，不确定历史作者次数。
- 接入合成测试并更新用户、维护及数据契约文档。

## Capabilities

### New Capabilities
- skill-provenance: 当前 Skill 来源候选、离线元数据、显式声明映射与报告展示。

### Modified Capabilities
- 无；原有计数、去重、source 字段与默认输出不变。

## Impact

涉及独立 provenance 模块、Skill 报告可选字段、CLI/渲染接线与测试入口。schemaVersion 继续为 1，新增字段仅在开关启用时出现；旧读取器应允许附加字段。不添加依赖，不修改 Hooks 分支。

## Non-goals

不自动认证 OpenAI 官方或开源许可，不构建安装签名链、远程仓库调查或事件时快照，不回填历史作者排行榜，不扫描账号/秘密配置，不推送、发布或归档。
