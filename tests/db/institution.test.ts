import test from 'node:test';
import assert from 'node:assert/strict';
import type { InstitutionMetric } from '../../src/domain/institution.js';

test('institution metric can explicitly represent missing data without zero filling', () => {
  const missing: InstitutionMetric = {
    metricKey: 'staff.doctors', metricValue: null, unit: 'nafar',
    sourceType: 'unavailable', sourceName: null, fetchedAt: null
  };
  assert.equal(missing.metricValue, null);
  assert.notEqual(missing.metricValue, 0);
  assert.equal(missing.sourceType, 'unavailable');
});

test('live metric retains source provenance and fetch timestamp', () => {
  const metric: InstitutionMetric = {
    metricKey: 'kpi.score', metricValue: 88, unit: 'ball', sourceType: 'live',
    sourceName: 'KPI', fetchedAt: '2026-10-15T05:00:00.000Z'
  };
  assert.equal(metric.sourceName, 'KPI');
  assert.ok(metric.fetchedAt);
});
