import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const serviceUrl = new URL('../../src/executive/service.ts', import.meta.url);
const institution = (id: string, districtKey = 'gijduvon') => ({ id, officialName: id, type: 'TTB', districtKey, address: null, leaderName: null, phone: null, latitude: null, longitude: null });
const executive = { id: 'e', username: 'exec', role: 'executive' as const, scopes: [] };

test('executive today service exists', () => {
  assert.ok(existsSync(serviceUrl), 'src/executive/service.ts must exist');
});

test('attention list is severity then score ordered and truncated to ten', async () => {
  if (!existsSync(serviceUrl)) return assert.fail('src/executive/service.ts must exist');
  const { buildExecutiveToday } = await import('../../src/executive/service.js');
  const institutions = Array.from({ length: 12 }, (_, i) => institution(`inst-${i + 1}`));
  const risks = institutions.map((item, i) => ({ id: i + 1, institutionId: item.id, score: 50 + i, severity: i >= 9 ? 'red' : 'amber', coveragePct: 80, calculatedAt: '2026-10-15T10:00:00Z', factors: [] }));
  const result = buildExecutiveToday({ principal: executive, institutions, risks: risks as any, alerts: [], integrations: [], generatedAt: new Date('2026-10-15T10:05:00Z') });
  assert.equal(result.topAttention.length, 10);
  assert.deepEqual(result.topAttention.slice(0, 3).map((x: any) => x.institutionId), ['inst-12', 'inst-11', 'inst-10']);
  assert.equal(result.generatedAt, '2026-10-15T10:05:00.000Z');
});

test('no risk data is explicit unavailable with zero data coverage, not invented scores', async () => {
  if (!existsSync(serviceUrl)) return assert.fail('src/executive/service.ts must exist');
  const { buildExecutiveToday } = await import('../../src/executive/service.js');
  const result = buildExecutiveToday({ principal: executive, institutions: [institution('a'), institution('b')], risks: [], alerts: [], integrations: [], generatedAt: new Date('2026-10-15T10:05:00Z') });
  assert.equal(result.summary.institutions, 2);
  assert.equal(result.riskDistribution.unavailable, 2);
  assert.equal(result.dataCoverage.riskCoveragePct, 0);
  assert.deepEqual(result.topAttention, []);
});

test('scoped user sees only assigned district institutions, risks and critical alerts', async () => {
  if (!existsSync(serviceUrl)) return assert.fail('src/executive/service.ts must exist');
  const { buildExecutiveToday } = await import('../../src/executive/service.js');
  const principal = { id: 'd', username: 'dist', role: 'district_manager' as const, scopes: [{ districtKey: 'gijduvon' }] };
  const institutions = [institution('g1', 'gijduvon'), institution('o1', 'olot')];
  const risks = [
    { id: 1, institutionId: 'g1', score: 80, severity: 'red', coveragePct: 80, calculatedAt: '2026-10-15T10:00:00Z', factors: [] },
    { id: 2, institutionId: 'o1', score: 90, severity: 'red', coveragePct: 90, calculatedAt: '2026-10-15T10:00:00Z', factors: [] }
  ];
  const alerts = [
    { id: 1, institutionId: 'g1', severity: 'critical', status: 'open' },
    { id: 2, institutionId: 'o1', severity: 'critical', status: 'open' },
    { id: 3, institutionId: null, sourceKey: 'qr', severity: 'critical', status: 'open' }
  ];
  const result = buildExecutiveToday({ principal, institutions, risks: risks as any, alerts: alerts as any, integrations: [], generatedAt: new Date() });
  assert.equal(result.summary.institutions, 1);
  assert.deepEqual(result.topAttention.map((x: any) => x.institutionId), ['g1']);
  assert.deepEqual(result.criticalAlerts.map((x: any) => x.id), [1]);
});

test('stale and offline integrations are included for province-wide executive, healthy and unavailable are not', async () => {
  if (!existsSync(serviceUrl)) return assert.fail('src/executive/service.ts must exist');
  const { buildExecutiveToday } = await import('../../src/executive/service.js');
  const integrations = [
    { key: 'kpi', label: 'KPI', status: 'online' },
    { key: 'qr', label: 'QR', status: 'stale' },
    { key: 'appeals', label: 'Murojaatlar', status: 'offline' },
    { key: 'never', label: 'Ulanmagan', status: 'unavailable' }
  ];
  const result = buildExecutiveToday({ principal: executive, institutions: [], risks: [], alerts: [], integrations: integrations as any, generatedAt: new Date() });
  assert.deepEqual(result.attentionSources.map((x: any) => x.key), ['qr', 'appeals']);
});
