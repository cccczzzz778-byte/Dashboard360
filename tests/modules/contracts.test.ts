import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnavailableModules, moduleDefinitions } from '../../src/domain/modules.js';

test('first release exposes exactly the ten approved monitoring modules', () => {
  assert.deepEqual(moduleDefinitions.map(x => x.key), ['passport','staff','patients','admissions','diseases','inpatient','digital','equipment','appeals','kpi']);
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
