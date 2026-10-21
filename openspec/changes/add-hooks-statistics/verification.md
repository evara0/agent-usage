## Environment

核验日期：2026-10-21（Asia/Shanghai）。本 worktree 起始 HEAD 为 `7b1891e6fecaaa186c9918c25a641455aec560aa`，初始干净且 detached；随后通过批准通道创建 `codex/hooks-statistics`。仅在本 worktree 修改授权文件。

Node.js v22.22.2，OpenSpec 1.13.0，Windows。`pnpm install --offline --frozen-lockfile` 使用本地缓存安装 54 个已锁定依赖，下载 0，没有新增依赖或更改锁文件。普通 sandbox 无法访问 Corepack 缓存，项目检查使用产品批准通道；没有改 ACL 或全局配置。

## Checks

最终代码版本按顺序运行，结果均为 exit 0：

| 命令 | 实际结果 |
| --- | --- |
| pnpm run test | 123 passed、0 failed、0 skipped；包含新增 Hook 核心/表格 11 项和全部原测试 |
| pnpm run typecheck | tsc --noEmit 通过 |
| pnpm run test:cli | 构建通过，50 passed、0 failed、0 skipped；包含新增 Hook CLI 6 项和 Skill/MCP 回归 |
| openspec validate --all --strict --no-interactive | 6 passed、0 failed，包含活动 change 与 5 个正式 specs |
| openspec validate --archived --strict --no-interactive | 5 passed、0 failed；仅校验，未修改归档 |
| git diff --check | 无空白错误；提交前另核对 staged diff |
| node dist/index.mjs --hooks --json | 本机默认目录实际返回 0 候选、0 调用、missingDirectories=1、no-imports、空 hooks；未制造执行样本 |

首次 test 为 122 passed、1 failed：新测试准备步骤使用 fs.rm 删除空目录得到 ERR_FS_EISDIR，尚未进入该项采集断言。已按要求暂停并报告，获得用户“允许修复并完成交付”授权后改为 rmdir；全量重跑全部通过。提交前又补充直接聚合器冲突元数据稳定排序断言，再次顺序运行上述三个 pnpm 脚本并全部通过。失败历史未被写成通过。

## Evidence Boundaries

- 实际打开的官方页面、版本生成 schema、少量本地只读结构调查及缺口见 design 和 [数据说明](../../../docs/hooks-statistics.md)。生成类型不是实际执行通知样本。
- 新增测试使用临时合成数据；覆盖配置与执行分离、身份关联、重放、乱序、缺失、状态/时间/身份/耗时冲突、阻断/停止、窗口边界、时间单位声明、零/缺失耗时、损坏行、质量、最小投影、表格限制、JSON 完整、模式冲突和直接中文 UTF-8 输出。
- 不声称已验证真实通知兼容、原生日志完整性、异步 Hook 或其他 Node/OS 组合；未部署持续采集。默认空结果不代表无 Hook 运行。
- Skill/MCP 公共 contracts、report、采集/聚合/渲染及 output 模块未修改；来源语义仍为 codex。
- 未修改原 checkout、其他 worktree、真实日志或用户 Codex 配置；没有安装全局 Hook、执行实际 Hook 命令、启用遥测或访问外部服务制造样本。

## Delivery

交付独立 HookRecord / HookStats、collectHookEvents、aggregateHookEvents、renderHooksTable 和 --hooks CLI。接口、字段与命令示例见 docs/hooks-statistics.md。保留活动 change 供总控审查，不合并 main、不推送、不发布、不自动归档、不删除 worktree。最终 SHA 通过聊天交付，以免提交内容自引用。
