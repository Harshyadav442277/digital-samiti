import type { Database } from '@/lib/database';
import { Group } from './model';
import { indiaDate, processAutoPay } from './autopay';
export async function runAutoPayBatch(db: Database, now = new Date()) {
  const candidates = await db.prepare("SELECT id, data, version FROM samiti_groups WHERE EXISTS (SELECT 1 FROM json_each(samiti_groups.data, '$.autoPay') AS p WHERE json_extract(p.value, '$.status') = 'active' AND json_extract(p.value, '$.nextDate') <= ?) LIMIT 100").bind(indiaDate(now)).all<{ id: string; data: string; version: number }>();
  let contributions = 0; let updated = 0; let conflicts = 0;
  for (const row of candidates.results) {
    const g: Group = JSON.parse(row.data); const result = processAutoPay(g, now);
    if (!result.changed) continue;
    const write = await db.prepare('UPDATE samiti_groups SET data = ?, version = version + 1 WHERE id = ? AND version = ?').bind(JSON.stringify(g), row.id, row.version).run();
    if (write.meta.changes === 1) { updated++; contributions += result.contributions; } else conflicts++;
  }
  return { mode: 'demo', scanned: candidates.results.length, updated, contributions, conflicts, checkedAt: now.toISOString() };
}
export async function autoPaySummary(db: Database) {
  const row = await db.prepare("SELECT COUNT(*) AS activePlans, COALESCE(SUM(CASE WHEN json_extract(p.value, '$.nextDate') <= ? THEN 1 ELSE 0 END), 0) AS duePlans FROM samiti_groups, json_each(samiti_groups.data, '$.autoPay') AS p WHERE json_extract(p.value, '$.status') = 'active'").bind(indiaDate()).first<{ activePlans: number; duePlans: number }>();
  return { mode: 'demo', ...row };
}
