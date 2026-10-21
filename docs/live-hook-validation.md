# 真实 Hook 统计验证记录

日期：2026-10-21。工作树：`codex/hooks-statistics`。CLI：`0.163.0-alpha.10.2`。

## 验证结论

**通过：Codex 实际执行测试 Hook → 捕获原生通知 → 离线导入 → 30 天报告，整条链路得到验证。**

| 项目 | 结果 |
| --- | --- |
| 事件 / 处理器 | SessionStart / 同步 command |
| 实际执行时间 | 2026-10-21 11:25:38.918（北京时间） |
| 调用 / 成功 / 失败 / 未知 | 1 / 1 / 0 / 0 |
| 原生耗时 / 耗时样本 | 756 ms / 1 |
| 导入文件 / 开始通知 / 完成通知 | 1 / 1 / 1 |
| 无效信号、畸形行、冲突、结果缺失 | 均为 0 |
| 当前原生时间戳单位 | Unix 秒，已与执行标记和采集时间窗口对照 |

该结果仅包含本次隔离测试导入的一次执行，不能代表个人过去 30 天全部 Hook 使用情况。未部署持续采集器，也未证明原生会话历史会自动保存 Hook 通知；异步 Hook 不在本次验证范围。

## 触发时机与先前失败原因

先前仅调用 thread/start，采集 1.5 秒，没有通知或执行标记。用户完成正常 `/hooks` 审查信任后，再做受控对照：

1. hooks/list 确认唯一测试 Hook 为 trusted、enabled=true、isManaged=false。
2. 创建全新临时线程后继续观察 15 秒，通知仍为 0，标记不存在。
3. 首次 turn/start 提交最小测试输入后，收到同一 thread/run 的 hook/started（running）和 hook/completed（completed），同时产生执行标记。
4. 捕获完成后立即请求 turn/interrupt，并结束测试服务器。

因此在本机版本、此测试条件下，SessionStart 在首次 turn 阶段实际触发，单独创建线程不足以完成这项验证。该结论是版本限定的实际观测，不宣称为所有版本的接口保证。先前的模型列表刷新超时不能据此认定为 Hook 未触发原因。

## 安全与授权边界

使用 `.local/live-hook-validation/home` 作为子进程专用 CODEX_HOME，不修改个人全局配置，不复制认证。用户在隔离 CLI 完成登录并正常审查信任 Hook。测试脚本只写同目录 execution-marker.json，包含固定测试名及时间。配置来源显示 user，是因为 hooks.json 位于隔离 CODEX_HOME，并非安装到了个人全局目录。

首次 turn 会启动模型生成，自动审批曾因缺少明确外部调用授权而拒绝测试命令；该命令没有执行。用户随后明确回复 ok，授权一次最小模型请求。实际输入只要求回复 OK，不调用工具或修改文件；未更改模型、供应商或安全策略。

## 复现与证据位置

以下文件均在此 worktree 的忽略目录 `.local/live-hook-validation/`，不进入 Git：

- test-hook.mjs、home/hooks.json：用户已审查的测试定义。
- investigate-trigger.mjs：分阶段采集与及时中断脚本（重跑会再次提交一次模型请求，应重新确认用途）。
- execution-marker.json：实际脚本执行标记。
- native-signals.json：实际收到的两条生命周期通知，未手写结果。
- timeline.json：通知方法、收到时间和 thread/turn 采集阶段，不保留模型消息正文。
- export-evidence.mjs：断言匹配 thread/run、成功状态、时间窗口及秒级单位后原样导出。
- home/usage-hooks/live-session-start.jsonl：显式声明 unix-s 的离线导入。
- report-30d.json：Node 直接写出的 UTF-8 统计结果。

在当前 Hooks 工作树复查已有导入数据（不触发 Hook、不调用模型）：

```powershell
node dist/index.mjs --hooks --days 30 --codex-dir .local/live-hook-validation/home --json --output .local/live-hook-validation/report-30d.json
```

导入头为 agent_usage_hook_import / schemaVersion=1 / timestampUnit=unix-s，其后原样保存原生通知。用 Node assert 核对 totals、开始/完成通知、扫描质量、窗口与耗时，全部通过。原 CLI 统计实现与公共契约没有修改。

依据：[App Server 协议](https://learn.chatgpt.com/docs/app-server)、[Hooks 事件与信任流程](https://learn.chatgpt.com/docs/hooks)。
