// 仅核对本目录的合成规划样例，不是生产解析器或采集器。
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

let commonEvidence;
const expected = { logs: [2, 3, null, 5], hooks: [null, null, 4, 4], combined: [2, 3, 4, 6] };
for (const mode of ['logs', 'hooks', 'combined']) {
  const report = JSON.parse(readFileSync(new URL(`${mode}.json`, import.meta.url), 'utf8'));
  assert.equal(report.mode, mode);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.kind, 'skill-usage-comparison');
  assert.equal(report.countUnit, 'skill-turn');
  assert.equal(report.evidence.length, 9);
  assert.deepEqual(report.deduplication.unresolvedEvidence, []);
  if (commonEvidence) assert.deepEqual(report.evidence, commonEvidence);
  else commonEvidence = report.evidence;

  const identities = new Set();
  const groups = new Map();
  const selected = [];
  for (const item of report.evidence) {
    const identity = JSON.stringify([report.sourceInstanceId, item.method, item.sessionId, item.sourceRecordId]);
    assert(!identities.has(identity), '样例不应含同来源重复身份');
    identities.add(identity);
    assert.equal(item.skillKey, 'standalone:handoff');
    const time = Date.parse(item.occurredAt);
    assert(Number.isFinite(time));
    if (time < Date.parse(report.period.start) || time >= Date.parse(report.period.end)) continue;
    if (mode !== 'combined' && item.method !== mode) continue;
    selected.push(item);
    const key = JSON.stringify([report.sourceInstanceId, item.sessionId, item.turnId, item.skillKey]);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const stats = {
    logsExplicit: mode === 'hooks' ? null : 0,
    logsInferred: mode === 'hooks' ? null : 0,
    hooks: mode === 'logs' ? null : 0,
    uniqueTotal: groups.size,
  };
  for (const group of groups.values()) {
    const logs = group.filter(item => item.method === 'logs');
    if (logs.some(item => ['skill_requested', 'skill_injected'].includes(item.type))) stats.logsExplicit++;
    else if (logs.length) stats.logsInferred++;
    if (group.some(item => item.method === 'hooks')) stats.hooks++;
  }
  assert.deepEqual(Object.values(stats), expected[mode]);
  for (const [key, value] of Object.entries(stats)) {
    assert.equal(report.skills[0][key], value);
    assert.equal(report.totals[key], value);
  }
  const latest = Math.max(...selected.map(item => Date.parse(item.occurredAt)));
  assert.equal(Date.parse(report.skills[0].lastRecorded), latest);
  assert.equal(report.totals.skills, 1);
  assert.equal(report.skills.length, 1);
  console.log(`${mode}: ${Object.values(stats).map(value => value ?? 'null').join('/')} OK`);
}
