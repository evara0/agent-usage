## 1. 设计与基线
- [x] 1.1 核对独立 worktree、功能分支、共同基线及公共契约
- [x] 1.2 创建并补齐本 change 的 proposal、spec、design 和 tasks

## 2. 模块实施
- [x] 2.1 实现完整 Markdown 概览、上下文、排名、时间及限制说明
- [x] 2.2 安全处理特殊字符、空统计、长名称并保持输入不变
- [x] 2.3 新增合成测试及源码使用说明

## 3. 验证与交付
- [x] 3.1 类型检查、现有回归及显式编译运行 Markdown 新测试
- [x] 3.2 OpenSpec 严格校验、范围和差异检查，记录实际验收结果
- [x] 3.3 在 codex/markdown-report 本地提交并报告接口与总控待办

## 4. 总控集成（本分支不实施）
- [ ] 4.1 接入 CLI Markdown 输出参数及对应行为验证
- [ ] 4.2 将 Markdown 测试加入 package.json 的正式测试入口
- [ ] 4.3 更新 README 的 Markdown 使用说明
