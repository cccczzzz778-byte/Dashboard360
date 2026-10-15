import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const repoUrl = new URL('../../src/alerts/repository.ts', import.meta.url);

test('alert repository exists', () => {
  assert.ok(existsSync(repoUrl), 'src/alerts/repository.ts must exist');
});

test('upsertActive uses dedup key and updates existing active alert instead of inserting duplicates', async () => {
  if (!existsSync(repoUrl)) return assert.fail('src/alerts/repository.ts must exist');
  const { createAlertRepository } = await import('../../src/alerts/repository.js');
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const pool = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (/insert into alerts/i.test(sql)) return { rows: [{ id: 5, dedupKey: 'risk:inst-1', status: 'open' }] };
      return { rows: [] };
    }
  } as any;
  const repo = createAlertRepository(pool);
  const saved = await repo.upsertActive({
    institutionId: 'inst-1', sourceKey: null, alertType: 'risk', severity: 'critical',
    title: 'Yuqori risk', reason: 'Risk 82', dedupKey: 'risk:inst-1', metadata: { coveragePct: 75 }
  });
  assert.equal(saved.id, 5);
  const insert = calls.find(call => /insert into alerts/i.test(call.sql));
  assert.ok(insert);
  assert.match(insert!.sql.toLowerCase(), /on conflict\s*\(dedup_key\)\s*where\s*status\s+in/);
  assert.match(insert!.sql.toLowerCase(), /do update/);
  assert.ok(insert!.values?.includes('risk:inst-1'));
  assert.equal(insert!.sql.includes('risk:inst-1'), false);
});

test('active alert listing excludes resolved and closed states', async () => {
  if (!existsSync(repoUrl)) return assert.fail('src/alerts/repository.ts must exist');
  const { createAlertRepository } = await import('../../src/alerts/repository.js');
  let sqlSeen = '';
  const pool = {
    async query(sql: string) {
      sqlSeen = sql;
      return { rows: [{ id: 1, dedupKey: 'x', institutionId: null, sourceKey: 'qr', alertType: 'integration', severity: 'warning', title: 'QR stale', reason: 'stale', status: 'open', firstSeenAt: '2026-10-15T09:00:00Z', lastSeenAt: '2026-10-15T10:00:00Z', metadata: {} }] };
    }
  } as any;
  const rows = await createAlertRepository(pool).listActive();
  assert.equal(rows.length, 1);
  assert.match(sqlSeen.toLowerCase(), /status\s+in\s*\('open','acknowledged'\)/);
});
