import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const repoUrl = new URL('../../src/integrations/repository.ts', import.meta.url);

test('integration repository exists', () => {
  assert.ok(existsSync(repoUrl), 'src/integrations/repository.ts must exist');
});

test('source configuration and run writes are parameterized', async () => {
  if (!existsSync(repoUrl)) return assert.fail('src/integrations/repository.ts must exist');
  const { createIntegrationRepository } = await import('../../src/integrations/repository.js');
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const pool = { async query(sql: string, values?: unknown[]) { calls.push({ sql, values }); return { rows: [] }; } } as any;
  const repo = createIntegrationRepository(pool);
  await repo.upsertSource({ key: 'kpi-live', label: 'KPI Live', enabled: true, authState: 'configured', staleAfterSeconds: 3600 });
  await repo.recordRun({ sourceKey: 'kpi-live', status: 'success', startedAt: new Date('2026-10-15T09:00:00Z'), finishedAt: new Date('2026-10-15T09:00:01Z'), latencyMs: 1000, errorCode: null, metadata: { count: 3 } });
  assert.ok(calls.some(call => /insert into integration_sources/i.test(call.sql)));
  assert.ok(calls.some(call => /insert into integration_runs/i.test(call.sql)));
  assert.ok(calls.every(call => !call.sql.includes('kpi-live')), 'source key must be parameterized');
});

test('listHealth maps latest run metadata through freshness evaluation', async () => {
  if (!existsSync(repoUrl)) return assert.fail('src/integrations/repository.ts must exist');
  const { createIntegrationRepository } = await import('../../src/integrations/repository.js');
  const pool = {
    async query(sql: string) {
      if (/from integration_sources/i.test(sql)) return { rows: [
        { key: 'kpi', label: 'KPI', enabled: true, authState: 'configured', staleAfterSeconds: 3600, lastStatus: 'success', lastSuccessAt: '2026-10-15T09:45:00Z', lastRunAt: '2026-10-15T09:45:00Z', latencyMs: 120, errorCode: null },
        { key: 'dmed', label: 'DMED', enabled: true, authState: 'browser-auth', staleAfterSeconds: 3600, lastStatus: 'auth_required', lastSuccessAt: null, lastRunAt: '2026-10-15T09:50:00Z', latencyMs: null, errorCode: 'login_required' }
      ] };
      return { rows: [] };
    }
  } as any;
  const health = await createIntegrationRepository(pool).listHealth(new Date('2026-10-15T10:00:00Z'));
  assert.equal(health[0].status, 'online');
  assert.equal(health[0].latencyMs, 120);
  assert.equal(health[1].status, 'auth_required');
  assert.equal(health[1].errorCode, 'login_required');
});
