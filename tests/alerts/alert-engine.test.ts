import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const engineUrl = new URL('../../src/alerts/engine.ts', import.meta.url);

test('alert engine exists', () => {
  assert.ok(existsSync(engineUrl), 'src/alerts/engine.ts must exist');
});

test('red and amber risk produce deterministic alerts while unavailable risk produces none', async () => {
  if (!existsSync(engineUrl)) return assert.fail('src/alerts/engine.ts must exist');
  const { deriveAlerts } = await import('../../src/alerts/engine.js');
  const red = deriveAlerts({ institutionId: 'inst-1', risk: { score: 82, severity: 'red', coveragePct: 75 }, integrations: [] });
  assert.equal(red.length, 1);
  assert.equal(red[0].severity, 'critical');
  assert.equal(red[0].dedupKey, 'risk:inst-1');
  const amber = deriveAlerts({ institutionId: 'inst-1', risk: { score: 55, severity: 'amber', coveragePct: 80 }, integrations: [] });
  assert.equal(amber[0].severity, 'warning');
  const missing = deriveAlerts({ institutionId: 'inst-1', risk: { score: null, severity: 'unavailable', coveragePct: 0 }, integrations: [] });
  assert.deepEqual(missing, []);
});

test('integration health states produce stable source-specific alerts without fabricating healthy alerts', async () => {
  if (!existsSync(engineUrl)) return assert.fail('src/alerts/engine.ts must exist');
  const { deriveAlerts } = await import('../../src/alerts/engine.js');
  const alerts = deriveAlerts({ institutionId: null, risk: null, integrations: [
    { key: 'kpi', label: 'KPI', status: 'online' },
    { key: 'qr', label: 'QR', status: 'stale' },
    { key: 'appeals', label: 'Murojaatlar', status: 'offline' },
    { key: 'dmed', label: 'DMED', status: 'auth_required' },
    { key: 'lab', label: 'Laboratoriya', status: 'degraded' },
    { key: 'never', label: 'Ulanmagan', status: 'unavailable' }
  ] });
  assert.equal(alerts.some((x: any) => x.sourceKey === 'kpi'), false);
  assert.equal(alerts.find((x: any) => x.sourceKey === 'qr')?.severity, 'warning');
  assert.equal(alerts.find((x: any) => x.sourceKey === 'appeals')?.severity, 'critical');
  assert.equal(alerts.find((x: any) => x.sourceKey === 'dmed')?.severity, 'warning');
  assert.equal(alerts.find((x: any) => x.sourceKey === 'lab')?.severity, 'warning');
  assert.equal(alerts.find((x: any) => x.sourceKey === 'never')?.severity, 'info');
  assert.equal(new Set(alerts.map((x: any) => x.dedupKey)).size, alerts.length);
});
