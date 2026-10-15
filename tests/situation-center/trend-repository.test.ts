import test from 'node:test';
import assert from 'node:assert/strict';
import { listMetricTrend } from '../../src/db/index.js';

test('metric trend reads one institution history with parameterized bounded query', async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const pool = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      return {
        rows: [
          { period: '2026-09-01', metricValue: '72.5', sourceState: 'manual' },
          { period: '2026-10-01', metricValue: '81', sourceState: 'imported' }
        ]
      };
    }
  } as any;

  const rows = await listMetricTrend(pool, {
    institutionIds: ['inst-1'],
    metricKey: 'kpi.score',
    from: '2026-09-01',
    to: '2026-10-31'
  });

  assert.deepEqual(rows, [
    { period: '2026-09-01', value: 72.5, sourceState: 'manual' },
    { period: '2026-10-01', value: 81, sourceState: 'imported' }
  ]);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].values?.includes('inst-1'));
  assert.ok(calls[0].values?.includes('kpi.score'));
  assert.ok(!calls[0].sql.includes('inst-1'));
  assert.ok(!calls[0].sql.includes('kpi.score'));
});

test('metric trend refuses multi-institution aggregation until metric aggregation semantics exist', async () => {
  const pool = { async query() { throw new Error('query must not run'); } } as any;
  const rows = await listMetricTrend(pool, {
    institutionIds: ['inst-1', 'inst-2'],
    metricKey: 'kpi.score',
    from: '2026-09-01',
    to: '2026-10-31'
  });
  assert.deepEqual(rows, []);
});
