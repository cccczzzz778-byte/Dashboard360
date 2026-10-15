import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnavailableModules } from '../../src/domain/modules.js';
import { mergeNamespacedMetrics, namespacedMetricKey } from '../../src/domain/metric-namespace.js';

test('metric storage keys are namespaced by module', () => {
  assert.equal(namespacedMetricKey('appeals','overdue'), 'appeals.overdue');
  assert.equal(namespacedMetricKey('execution','overdue'), 'execution.overdue');
});

test('same local metric name updates only the intended module', () => {
  const modules = buildUnavailableModules();
  mergeNamespacedMetrics(modules, [{
    metricKey: 'appeals.overdue', metricValue: '7', unit: 'ta', sourceType: 'manual', sourceName: 'test', fetchedAt: new Date().toISOString()
  }]);
  const appeals = modules.find(x => x.key === 'appeals')!;
  const execution = modules.find(x => x.key === 'execution')!;
  assert.equal(appeals.metrics.find(x => x.key === 'overdue')?.value, '7');
  assert.equal(execution.metrics.find(x => x.key === 'overdue')?.value, null);
});
