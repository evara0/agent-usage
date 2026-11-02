# Skill Markdown 报告

Markdown 与新 JSON/表格使用同一份 `SkillComparisonReport`，按同实例、会话、轮次、技能去重。

```powershell
node ./dist/index.mjs --skill-method combined --days 30 --markdown --output .local/skill-usage.md
node ./dist/index.mjs --skill-method logs --days 30 --markdown
node ./dist/index.mjs --skill-method hooks --skill-counts strict --markdown
```

首次本机查询需先 `setup`；也可用 `--skill-evidence PATH` 独立重放已有证据包。`--days`、`--codex-dir`、`--skill-counts resolved|strict` 与新 JSON 的含义一致。`--limit` 不截断 Markdown。

## 输出与口径

固定六列：Skill、Logs Explicit、Logs Inferred、Hooks、Unique Total、Last Recorded。最近时间按报告声明的时区显示 `YYYY-MM-DD HH:mm`，不保留旧版的 ISO 排名列或扫描元信息。

报告注明 mode、计数策略、skill-turn 单位、统计窗口、时区和生成时间。resolved 只统计身份完整的证据，另列当前范围的未决候选；strict 保留受影响的未知计数。未选来源或严格未知为 `—`，已知零为 `0`。未决数量只包括选中来源及当前窗口，原始明细仍保留在 JSON。

计数来自上游新模型，Unique Total 是选中来源技能轮次的并集，不代表执行成功或完整历史。报告展示上游的全部技能和排序，不重新采集、聚合、筛选技能或修改输入。

## 旧命令迁移

旧 `--days 30 --markdown` 不再生成旧口径报告，会在扫描前提示增加 `--skill-method logs|hooks|combined`。旧 `--strict` 是排除推断，不等于新严格未知策略；新命令使用 `--skill-counts strict`。`--provenance --markdown` 不再支持，出处信息与新统计报告分开查询。旧非 Markdown 表格和 JSON 暂时保留。

`--json` 与 `--markdown` 互斥，新 Markdown 也不能和 `--mcp`、`--hooks`、`--provenance` 或旧 `--strict` 混用；错误在读取输入及写文件前拒绝。

## 源码与文件输出

```ts
import type { SkillComparisonReport } from './src/skill-evidence-types.js';
import { renderMarkdown } from './src/render/markdown.js';
function formatReport(report: SkillComparisonReport): string {
  return renderMarkdown(report);
}
```

这是源码级接口，不再接收旧 `SkillUsageReport`。渲染器只返回字符串，使用上游声明时区，不读取当前时钟或默认时区。名称与文本转义 Markdown/HTML、折叠换行并移除控制字符，长名称不截断；日期时间单元格来自格式化后的有效报告时间。

CLI 通过统一输出模块直接写无 BOM UTF-8，创建父目录并覆盖目标；指定 `--output` 时 stdout 为空，写入失败返回非零状态。测试覆盖三种视图、策略、未决范围、重放、完整行、特殊字符及中文路径；执行 `pnpm run test`、`pnpm run typecheck`、`pnpm run test:cli` 验证。
