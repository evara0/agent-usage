# 输出样例

以下全部为合成目标样例，尚无新功能实现。JSON 与人读列保持已确认的名称、空格和大小写；主表不追加采集时段或未覆盖解释。JSON 保存诊断和身份，不能由表格本身推导。

## Logs

```text
Date: 2026-10-28    Mode: Logs

Skill       Logs Explicit   Logs Inferred   Hooks   Unique Total   Last Recorded
handoff                 2               3       —              5   2026-10-28 18:30

5 skill-turns · 1 skill
```

完整输入与派生报告见 [logs.json](logs.json)。

## Hooks

```text
Date: 2026-10-28    Mode: Hooks

Skill       Logs Explicit   Logs Inferred   Hooks   Unique Total   Last Recorded
handoff                 —               —       4              4   2026-10-28 18:35

4 skill-turns · 1 skill
```

完整输入与派生报告见 [hooks.json](hooks.json)。

## Combined

```text
Date: 2026-10-28    Mode: Logs + Hooks

Skill       Logs Explicit   Logs Inferred   Hooks   Unique Total   Last Recorded
handoff                 2               3       4              6   2026-10-28 18:35

6 skill-turns · 1 skill
```

完整输入与派生报告见 [combined.json](combined.json)。

## 对照依据

三份 JSON 使用完全相同的 9 条 evidence，只有 mode 及派生结果不同，便于验证切换视图不丢弃原证据。时间均为北京时间，报告只按 occurredAt 筛选和取最大值。

| 技能轮次 | 日志证据 | Hook 证据 | 归组结果 |
| --- | --- | --- | --- |
| session-a / turn-01 | 指定 | 读取尝试 | 两来源共同组；日志明确 |
| session-a / turn-02 | 注入 | 无样例证据 | 日志独有；日志明确 |
| session-a / turn-03 | 读取尝试 | 相同调用读取尝试 | 两来源共同组；日志推断 |
| session-a / turn-04 | 读取尝试 | 相同调用读取尝试 | 两来源共同组；日志推断 |
| session-a / turn-05 | 读取尝试 | 无样例证据 | 日志独有；日志推断 |
| session-a / turn-06 | 无样例证据 | 读取尝试 | Hook 独有 |

所有组共享实例 demo-codex-home 与 skillKey=standalone:handoff。日志组共 5 个，Hook 组共 4 个，交集 3 个，故并集 5+4-3=6。每个来源 sourceRecordId 标识自己的观测，不因两来源相同 ID 就删除其中一份证据；turn-01 的指定与读取更不是同一个原生事件，只在技能轮次口径下归组。

## JSON 的最小字段说明

- sourceInstanceId：同一已确认 Codex 数据实例在两适配器共享的标识，示例值没有认证含义。
- evidence：来源最小事实，包含 method、sourceRecordId、sessionId、turnId、skillKey、type 和 occurredAt。
- producer：可选整理工具与 automated/agent-assisted/manual 元信息，与原始 method 分开。
- deduplication：规则版本、共同键和未决候选；当前样例全部身份完整，unresolvedEvidence 为空。
- skills/totals：派生结果；完整报告必须包含。输入证据包可同时省略二者，提供时必须重算核对。
- null：未启用或不能确定，不是零。计数单位为技能轮次；读取尝试不表示执行成功。

缺 turnId、身份冲突、无依据人工声明等反例将在实施阶段补充为单独验收样例；本轮不声称它们已经通过实现验证。
