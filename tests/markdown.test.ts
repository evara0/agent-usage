import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SkillStats, SkillUsageReport } from '../src/contracts.js';
import { renderMarkdown } from '../src/render/markdown.js';

function skill(name: string, total: number, manual: number, inferredAuto: number): SkillStats {
  return {
    skill: name, total, manual, auto: total - manual, inferredAuto,
    lastUsedAt: '2026-10-20T07:30:00.000Z',
    sources: { codex: total }, daily: { '2026-10-20': total },
    projects: { 'D:/synthetic-project': total }, aliases: [name],
  };
}

function fixture(): SkillUsageReport {
  return {
    schemaVersion: 1, source: 'codex', generatedAt: '2026-10-20T08:00:00.000Z',
    windowDays: 2.5, strict: false, timeZone: 'Asia/Shanghai', filesScanned: 4, elapsedMs: 12.5,
    totals: { invocations: 10, manual: 3, auto: 7, skills: 3 },
    skills: [
      { ...skill('gamma', 3, 0, 1), lastUsedAt: null },
      skill('beta', 3, 2, 0),
      skill('alpha', 4, 1, 2),
    ],
  };
}

function deepFreeze(value: object): void {
  for (const nested of Object.values(value)) {
    if (nested !== null && typeof nested === 'object') deepFreeze(nested);
  }
  Object.freeze(value);
}

test('混合证据正确显示总数、明确与推断，不将 auto 全部视为推断', () => {
  const text = renderMarkdown(fixture());
  assert.ok(text.startsWith('# Codex Skill 使用报告\n'));
  for (const row of [
    '| 使用记录 | 10 |', '| 明确记录 | 7 |', '| 推断记录 | 3 |',
    '| 手动记录（manual） | 3 |', '| 自动记录（auto，含推断） | 7 |', '| Skill 数 | 3 |',
    '| 1 | alpha | 4 | 2 | 2 | 2026-10-20T07&#58;30&#58;00.000Z |',
    '| 2 | beta | 3 | 3 | 0 |', '| 3 | gamma | 3 | 2 | 1 | 无记录 |',
  ]) assert.ok(text.includes(row), row);
  assert.ok(text.indexOf('| 1 | alpha') < text.indexOf('| 2 | beta'));
  assert.ok(text.indexOf('| 2 | beta') < text.indexOf('| 3 | gamma'));
  assert.ok(text.includes('不代表执行成功次数或任务质量'));
  assert.ok(text.includes('inferredAuto 只是 auto 的子集'));
  assert.ok(text.includes('即使 history 不存在也加 1，不代表成功读取数'));
  assert.ok(text.includes('不能可靠区分子 Agent'));
  assert.ok(!text.includes('D:/synthetic-project'));
});

test('完整展示上下文，滚动小数窗口和原始 ISO 时间不转换时区', () => {
  const text = renderMarkdown(fixture());
  for (const context of [
    '报告版本（schemaVersion）：1', '来源：codex',
    '生成时间：2026-10-20T08&#58;00&#58;00.000Z',
    '最近 2.5 天（滚动 2.5×24 小时，非自然日）',
    'strict：false（包含明确与推断记录）', '日期分桶时区：Asia/Shanghai',
    '不转换下表 ISO 时间', '候选扫描路径数（filesScanned）：4',
    '扫描与聚合耗时（elapsedMs）：12.5 ms',
  ]) assert.ok(text.includes(context), context);
});

test('空统计保留全部历史、strict 和 UTC 上下文以及统计限制', () => {
  const report: SkillUsageReport = {
    ...fixture(), windowDays: null, strict: true, timeZone: 'UTC', filesScanned: 1, elapsedMs: 0,
    skills: [], totals: { invocations: 0, manual: 0, auto: 0, skills: 0 },
  };
  const text = renderMarkdown(report);
  for (const expected of [
    '| 使用记录 | 0 |', '| 明确记录 | 0 |', '| 推断记录 | 0 |', '| Skill 数 | 0 |',
    '统计窗口：全部历史', 'strict：true（已排除静态读取推断）', '日期分桶时区：UTC',
    '当前统计范围内没有可用的 Skill 使用记录。', '## 记录解读与统计限制',
  ]) assert.ok(text.includes(expected), expected);
  assert.ok(!text.includes('| 排名 |'));
  assert.ok(!/NaN|Infinity|undefined/.test(text));
});

test('嵌套冻结报告可重复渲染，排序不改输入，也不按窗口或 strict 再过滤', () => {
  const report = fixture();
  // 故意让元信息与记录不一致，证明渲染器不承担上游筛选职责。
  report.strict = true;
  report.windowDays = 0.01;
  const before = structuredClone(report);
  deepFreeze(report);
  const first = renderMarkdown(report);
  assert.equal(renderMarkdown(report), first);
  assert.deepEqual(report, before);
  assert.ok(first.includes('| 1 | alpha | 4 | 2 | 2 |'));
  assert.ok(first.includes('| 3 | gamma | 3 | 2 | 1 | 无记录 |'));
});

test('名称和元信息转义 Markdown、HTML、实体、换行与控制字符', () => {
  const report = fixture();
  report.skills = [skill('x|`*_[](){}#+!~\\<img src="x">&amp;\'\r\n\t伪造行\u2028\u2029\u0000\u001b', 1, 1, 0)];
  report.totals = { invocations: 1, manual: 1, auto: 0, skills: 1 };
  report.timeZone = '[zone](https://example.invalid)\n<script>alert(1)</script>';
  report.generatedAt = '<b>now</b>\r\n| spoof |';
  report.skills[0]!.lastUsedAt = '`time`\n| spoof |';
  const text = renderMarkdown(report);
  assert.ok(text.includes('x&#124;&#96;&#42;&#95;&#91;&#93;&#40;&#41;&#123;&#125;&#35;&#43;&#33;&#126;&#92;&#60;img src=&#34;x&#34;&#62;&#38;amp;&#39; 伪造行 '));
  assert.ok(text.includes('&#91;zone&#93;&#40;https&#58;//example.invalid&#41; &#60;script&#62;alert&#40;1&#41;&#60;/script&#62;'));
  assert.ok(text.includes('生成时间：&#60;b&#62;now&#60;/b&#62; &#124; spoof &#124;'));
  const dataRows = text.split('\n').filter(line => /^\| \d+ \|/.test(line));
  assert.equal(dataRows.length, 1);
  assert.equal(dataRows[0]!.split('|').length, 8);
  assert.ok(dataRows[0]!.includes('&#96;time&#96; &#124; spoof &#124;'));
  assert.ok(!/<img|<script|<b>|\[zone\]\(|&amp;|\r|\t|\u0000|\u001b|\u2028|\u2029/.test(text));
});

test('超过默认表格行数仍完整输出，长名称不截断', () => {
  const report = fixture();
  const longName = '中文-long-name-'.repeat(100);
  report.skills = Array.from({ length: 30 }, (_, index) => skill(index === 29 ? longName : `skill-${index}`, 1, 1, 0));
  report.totals = { invocations: 30, manual: 30, auto: 0, skills: 30 };
  const text = renderMarkdown(report);
  assert.equal(text.split('\n').filter(line => /^\| \d+ \|/.test(line)).length, 30);
  assert.ok(text.includes(`| ${longName} |`));
  assert.ok(text.includes('| Skill 数 | 30 |'));
  assert.ok(text.endsWith('\n'));
});
