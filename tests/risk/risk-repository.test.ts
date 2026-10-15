import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const repoUrl = new URL('../../src/risk/repository.ts', import.meta.url);

test('risk repository exists', () => {
  assert.ok(existsSync(repoUrl), 'src/risk/repository.ts must exist');
});

test('saving risk score and factors is transactional and parameterized', async () => {
  if (!existsSync(repoUrl)) return assert.fail('src/risk/repository.ts must exist');
  const { createRiskRepository } = await import('../../src/risk/repository.js');
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (/insert into risk_scores/i.test(sql)) return { rows: [{ id: 77 }] };
      return { rows: [] };
    },
    release() {}
  };
  const pool = { async connect() { return client; } } as any;
  const repo = createRiskRepository(pool);
  await repo.save('inst-1', {
    score: 80,
    severity: 'red',
    coveragePct: 66.67,
    factors: [
      { key: 'kpi', weight: 2, normalizedRisk: 80, sourceState: 'live', contribution: 80 },
      { key: 'staff', weight: 1, normalizedRisk: null, sourceState: 'unavailable', contribution: null }
    ]
  });

  assert.equal(calls[0].sql.trim().toLowerCase(), 'begin');
  assert.ok(calls.some(call => /insert into risk_scores/i.test(call.sql)));
  assert.equal(calls.filter(call => /insert into risk_factors/i.test(call.sql)).length, 2);
  assert.equal(calls.at(-1)?.sql.trim().toLowerCase(), 'commit');
  assert.ok(calls.every(call => !call.sql.includes('inst-1')), 'institution id must be parameterized');
});

test('risk repository rolls back when factor persistence fails', async () => {
  if (!existsSync(repoUrl)) return assert.fail('src/risk/repository.ts must exist');
  const { createRiskRepository } = await import('../../src/risk/repository.js');
  const calls: string[] = [];
  const client = {
    async query(sql: string) {
      calls.push(sql.trim().toLowerCase());
      if (/insert into risk_scores/i.test(sql)) return { rows: [{ id: 1 }] };
      if (/insert into risk_factors/i.test(sql)) throw new Error('write_failed');
      return { rows: [] };
    },
    release() {}
  };
  const pool = { async connect() { return client; } } as any;
  const repo = createRiskRepository(pool);
  await assert.rejects(() => repo.save('inst-1', {
    score: 50, severity: 'amber', coveragePct: 100,
    factors: [{ key: 'x', weight: 1, normalizedRisk: 50, sourceState: 'live', contribution: 50 }]
  }), /write_failed/);
  assert.ok(calls.includes('rollback'));
});
