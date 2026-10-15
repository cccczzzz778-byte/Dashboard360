import type { InstitutionMetric } from './institution.js';
import type { InstitutionModulePayload, SourceStatus } from './modules.js';

export function namespacedMetricKey(moduleKey: string, metricKey: string) {
  return `${moduleKey}.${metricKey}`;
}

function moduleStatus(metrics: InstitutionModulePayload['metrics']): SourceStatus {
  if (metrics.some(x => x.sourceStatus === 'error')) return 'error';
  if (metrics.some(x => x.sourceStatus === 'live')) return 'live';
  if (metrics.some(x => x.sourceStatus === 'manual')) return 'manual';
  if (metrics.some(x => x.sourceStatus === 'imported')) return 'imported';
  return 'unavailable';
}

export function mergeNamespacedMetrics(modules: InstitutionModulePayload[], stored: InstitutionMetric[]) {
  for (const saved of stored) {
    const separator = saved.metricKey.indexOf('.');
    if (separator <= 0) continue;
    const moduleKey = saved.metricKey.slice(0, separator);
    const metricKey = saved.metricKey.slice(separator + 1);
    const module = modules.find(x => x.key === moduleKey);
    if (!module) continue;
    const metric = module.metrics.find(x => x.key === metricKey);
    if (!metric) continue;
    metric.value = saved.metricValue;
    metric.unit = saved.unit ?? metric.unit ?? null;
    metric.sourceStatus = saved.sourceType === 'unavailable' ? 'unavailable' : saved.sourceType;
    metric.sourceName = saved.sourceName;
    metric.fetchedAt = saved.fetchedAt;
    module.status = moduleStatus(module.metrics);
  }
  return modules;
}
