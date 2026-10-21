# 总控验收记录 — 2026-10-21

## 范围与基线

共同基线：7b1891e6fecaaa186c9918c25a641455aec560aa。总控在 G:/agent-usage 的 main 执行，起始工作区干净。

| 分支 | 本次接收的提交 | 起始验收状态 |
| --- | --- | --- |
| codex/skill-provenance | a13ae7b523eba2cb0784bb23d4e6d6e4fc14cb51 调研；0d60e5f482db6d0af2dc9fa8d03b09a048baf205 实施 | 干净，共同基线可达 |
| codex/hooks-statistics | 9d786992c985b9f7a18016377884a4c5acd083c8 功能；02818062c0aeddd1b486f3c0ce5d5c3ad9ea4204 真实验证文档 | 功能代码已提交，后续真实验证文档由总控核对并补提交，提交后干净 |

先快进来源分支，再合并 Hooks，保留双方历史。冲突仅在 src/index.ts、package.json、README.md、MAINTENANCE.md；统一保留两个功能、测试入口和已实现使用说明。新增跨模式前置校验与两项 CLI 回归，覆盖七种 Hooks/来源非法参数组合、缺失映射不被读取及输出文件不生成，以及统一帮助信息。

## 分支复验

| 检查 | 来源工作树 | Hooks 工作树 |
| --- | --- | --- |
| pnpm run test | 140/140 | 123/123 |
| pnpm run typecheck | 通过 | 通过 |
| pnpm run test:cli（含构建） | 57/57 | 50/50 |
| OpenSpec --all --strict | 7/7 | 7/7（含真实验证变更） |
| OpenSpec --archived --strict | 5/5 | 5/5 |
| git diff --check | 通过 | 通过 |

来源分支首次检查命令因忽略目录 .local 尚不存在，日志重定向在启动测试前失败；创建输出目录后实际运行上述检查全部通过，未修改产品代码或测试来消除失败。一次工具编排存在 JavaScript 语法错误，也在工具调用前终止，修正后执行。此前自动审批额度不足导致新增跨模式测试操作没有执行；用户要求继续后重新核对状态并完成，不视为通过的测试。

## 合并后完整验收

Windows / Node.js v22.22.2；沿用现有锁文件与依赖，没有新增依赖或改锁。检查在同一 worktree 顺序执行，避免覆盖生成目录。

| 检查 | 结果 |
| --- | --- |
| pnpm run test | 151 passed，0 failed；含旧 Skills/MCP/Markdown/类型负例及来源、Hooks |
| pnpm run typecheck | 通过 |
| pnpm run test:cli | 构建通过；65 passed，0 failed；含跨模式两项 |
| OpenSpec --all --strict --no-interactive | 10/10；活动变更与正式规范 |
| OpenSpec --archived --strict --no-interactive | 5/5；仅检查，没有归档 |
| 合并后 CLI 重放真实 Hook 离线通知 | 调用 1、成功 1、失败 0、未知 0、耗时样本 1、总耗时 756 ms |
| 真实导入质量断言 | 开始/完成通知各 1，所有错误/重复/冲突/缺失计数均为 0 |
| 差异、冲突标记及文档本地链接 | 通过；修正新任务文档末尾空行后复核 |

CLI 回归包含旧默认 JSON 结构、统计口径、MCP、Markdown、完整输出/limit、无 BOM UTF-8 中文保存与错误参数前置拒绝。合并后真实重放只读取 Hooks 原工作树中已有导入数据，没有再次执行 Hook 或发起模型请求。复查报告保存在主线 .local/integrated-live-hook-report.json，不入库。

## 功能边界与审查结论

来源模块离线、有界读取，作者与发行方独立，文件声明 E3、用户声明 U，缺失保留 unknown，不凭名称/路径认证官方或原创；只关联当前候选，不回填历史作者。严格映射在日志扫描前校验，默认旧 JSON 无来源字段。审查未发现需要暂停的实质歧义。

Hooks 仅消费显式单位的同步通知，不部署采集器；原始路径和运行身份哈希，不凭配置/信任/文本推断执行。已有单次真实 SessionStart command 样本经 Unix 秒单位核对并成功重放；不能推断完整历史、所有事件、其他版本或异步覆盖。旧分支 verification.md 描述交付当时的样本缺口，当前范围以 docs/live-hook-validation.md 及本记录为准。

Git 忽略规则保持不变：.local、*.jsonl、*.log、.env、生成目录均排除。测试登录信息、原始通知、执行标记、真实报告和个人映射不进入提交。测试环境保留在原 worktree 的忽略目录，后续清理另需授权。

## 交付与保留

本轮以本地合并提交结束，main 同时包含两功能及总控兼容修订。OpenSpec 变更保持活动状态；不推送、不发布、不归档、不删除或回收 worktree。最终 commit SHA 在交付消息报告，避免提交自引用。
