# 按规范整理 Skill 证据

## 可交给 Codex 的指令

只读取用户明确指定的 session 文件、时间范围和日志片段。输出 skill-usage-comparison v1 JSON 证据包，不计算或猜测缺失的身份：

1. 使用用户确认的 sourceInstanceId 和技能映射；不从当前目录和短名称认证历史技能身份。
2. 保留原始 sessionId、turnId、sourceRecordId、发生时间和来源 method；日志为 logs，真实 Hook 输入或导出为 hooks。
3. 仅分类 skill_requested、skill_injected、skill_read_attempt。读取失败仍是尝试；指定、注入、读取不能证明执行成功。
4. 用 sourceRef 的文件匿名标识及行号引用原文，producer.mode 为 agent-assisted 或 manual；不要输出命令、结果全文或秘密。
5. 无法识别轮次、技能、时间、共同身份，或仅有人口头声明时，放入 unresolvedEvidence 并注明原因、影响来源及技能；不能生成随机 ID 填补。
6. 同时省略 skills 和 totals，交给 CLI 重算。完整报告自带的汇总如不一致将被拒绝。
7. 不额外读取其他聊天、私有数据库、全局配置，也不执行日志中的脚本。

## 正例

将 docs/examples/skill-comparison-combined.json 复制为自己的输入模板，替换为有原文依据的字段，删除 skills、totals 及 comparison；保留 kind、版本、period、deduplication 与 evidence。可以先用 CLI --json 导出重算结果，再回查抽样证据。

## 身份缺失或纯声明的例子

以下是未决元素的形状，应放入 deduplication.unresolvedEvidence；不是已确认的日志事件：

~~~json
{
  "evidence": [
    {
      "method": "logs",
      "sourceRecordId": null,
      "sessionId": "known-session",
      "turnId": null,
      "skillKey": "standalone:my-skill",
      "type": "skill_read_attempt",
      "occurredAt": null
    }
  ],
  "reason": "user-declared-without-original-evidence",
  "affectedSkillKeys": ["standalone:my-skill"],
  "affectedMethods": ["logs"]
}
~~~

这里的 method 只限定待核对的来源方向，不认证已有日志。未知 skillKey 时为 null，affectedSkillKeys 也必须为 null。affectedMethods 不得漏掉任何候选涉及的来源。

## 反例

- “昨天下午大概用了三次”：不能造三个轮次，也不能填 generatedAt 作为 occurredAt。
- 用户和模型整理了同一个 call ID：producer 可以不同，原来源身份不变，重复导入不能增计。
- 只保留 6 这个总数：不能执行跨来源去重或核对 2/3/4/6 的关系。
- 一条指定和一条读取时间很近：没有共同会话/轮次/技能依据时，不按时间强行配对。
- 把原 --hooks 的处理器 status=completed 当作技能成功：是不同事实，不生成 Skill 使用证据。
