# Markdown 报告模块

源码接口位于 `src/render/markdown.ts`：

```ts
import type { SkillUsageReport } from './src/contracts.js';
import { renderMarkdown } from './src/render/markdown.js';

// report 是上游组装的完整 SkillUsageReport。
function formatReport(report: SkillUsageReport): string {
  return renderMarkdown(report);
}
```

这是源码级接口，尚未建立 npm 库导出或 CLI 参数。总控需接入 Markdown 输出参数、正式测试脚本和 README 使用说明；本模块不读取真实日志，也不自行保存文件。

报告包含中文概览、版本与来源、生成时间、滚动窗口、strict、日期分桶时区、候选扫描路径数和耗时，随后展示全部 Skill 排名及最近记录时间。排名按 total 降序、同数按名称 localeCompare 排序，不受终端表格默认 25 行限制。输入对象和数组不会改变；重复调用不读取时钟或运行机器时区。

明确数使用 `total - inferredAuto`，推断数使用 `inferredAuto`；概览的推断总数来自完整 skills 的该字段之和，其他概览总数使用输入 totals。`auto` 包含明确自动注入和推断，不能将它全部视为推断。窗口与 strict 必须由上游兑现；渲染器不验证或再次过滤它们。最近记录时间保留输入 ISO 值，null 显示“无记录”。空 skills 显示无可用记录并保留上下文与限制说明。

输入字符串中的 Markdown 标记、HTML 字符及冒号转成字符实体，换行和制表符折叠为空格，其他控制字符去除，避免破坏表格、注入链接或 HTML。实体在 Markdown 阅读器中显示为原字符；源码中的时间冒号因此显示为 `&#58;`。长名称完整保留。推荐使用支持管道表格与字符实体的 Markdown 阅读器。

本报告不展开 daily、projects、sources 或 aliases 明细。计数代表去重后的使用证据，不代表执行成功或任务质量；filesScanned 是候选 rollout 数加 history 路径，不能当作成功读取数。其他契约见 [公共契约](usage-contract.md)。

本分支显式编译并运行新测试（项目 test 脚本尚未包含它）：

```powershell
pnpm exec tsc -p tsconfig.test.json
node --test .test-dist/tests/markdown.test.js
```

测试只用内存合成报告。与项目其他构建及测试顺序执行，避免同一个生成目录发生竞争。
