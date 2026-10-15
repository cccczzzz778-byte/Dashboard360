import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnavailableModules, moduleDefinitions } from '../../src/domain/modules.js';

test('production release exposes the full Muassasa 360 monitoring surface', () => {
  assert.ok(moduleDefinitions.length >= 25);
  const keys = new Set(moduleDefinitions.map(x => x.key));
  for (const key of [
    'passport','staff','patients','admissions','diseases','inpatient','emergency','maternalChild','screening',
    'laboratory','diagnostics','medicines','medicalEquipment','digital','dmed','finance','paidServices','procurement',
    'infrastructure','transport','appeals','qr','execution','kpi','quality','infectionControl','mortality',
    'telemedicine','meetings','alerts'
  ]) assert.ok(keys.has(key as any), `missing module: ${key}`);
});

test('unavailable modules use null values and source metadata instead of zeroes', () => {
  const modules = buildUnavailableModules();
  for (const module of modules) {
    assert.equal(module.status, 'unavailable');
    for (const metric of module.metrics) {
      assert.equal(metric.value, null);
      assert.equal(metric.sourceStatus, 'unavailable');
    }
  }
});

test('mixed source module payload can retain live, manual and unavailable metrics side by side', () => {
  const mixed = [
    { value: 90, sourceStatus: 'live' },
    { value: 12, sourceStatus: 'manual' },
    { value: null, sourceStatus: 'unavailable' }
  ];
  assert.deepEqual(mixed.map(x => x.value), [90, 12, null]);
});
