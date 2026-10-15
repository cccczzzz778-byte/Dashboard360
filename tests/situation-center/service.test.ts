import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const serviceUrl = new URL('../../src/situation-center/service.ts', import.meta.url);

const allowed = {
  id: 'allowed-1', officialName: 'Allowed TTB', type: 'TTB', districtKey: 'gijduvon', address: null,
  leaderName: null, phone: null, latitude: 40.1, longitude: 64.7, locationAccuracy: 'district-center' as const
};
const hidden = {
  id: 'hidden-1', officialName: 'Hidden TTB', type: 'TTB', districtKey: 'buxoro-shahar', address: null,
  leaderName: null, phone: null, latitude: 39.8, longitude: 64.4, locationAccuracy: 'city-center' as const
};
const principal = { id: 'u1', username: 'district', role: 'district_manager' as const, scopes: [{ districtKey: 'gijduvon' }] };

function deps() {
  return {
    institutions: {
      async listAll() { return [allowed, hidden]; },
      async findById(id: string) { return [allowed, hidden].find(x => x.id === id) ?? null; }
    },
    metrics: {
      async listLatest(institutionId: string) {
        if (institutionId === 'allowed-1') return [];
        return [{ metricKey:'staff.doctors', metricValue:'99', unit:'nafar', sourceType:'manual', sourceName:'x', fetchedAt:new Date().toISOString() }];
      },
      async listTrend() { return []; }
    },
    risks: {
      async listLatest() { return [{ id:2, institutionId:'hidden-1', score:88, severity:'red', coveragePct:100, calculatedAt:new Date().toISOString(), factors:[] }]; },
      async latest(id: string) { return id === 'hidden-1' ? { id:2, institutionId:id, score:88, severity:'red', coveragePct:100, calculatedAt:new Date().toISOString(), factors:[] } : null; }
    },
    alerts: {
      async listActive() {
        return [
          { id:1, institutionId:'allowed-1', sourceKey:null, alertType:'risk', severity:'warning', title:'Allowed alert', reason:'x', dedupKey:'a', status:'open', firstSeenAt:null, lastSeenAt:null, metadata:{} },
          { id:2, institutionId:'hidden-1', sourceKey:null, alertType:'risk', severity:'critical', title:'Hidden alert', reason:'x', dedupKey:'b', status:'open', firstSeenAt:null, lastSeenAt:null, metadata:{} }
        ];
      }
    },
    integrations: { async listHealth() { return []; } }
  } as any;
}

test('bootstrap is scope filtered and null safe', async () => {
  assert.ok(existsSync(serviceUrl), 'src/situation-center/service.ts must exist');
  if (!existsSync(serviceUrl)) return;
  const { createSituationCenterService } = await import('../../src/situation-center/service.js');
  const result = await createSituationCenterService(deps()).buildBootstrap(principal);
  assert.deepEqual(result.institutions.map((x: any) => x.id), ['allowed-1']);
  assert.equal(result.institutions[0].risk.severity, 'unavailable');
  assert.equal(result.summary.doctors, null);
  assert.equal(result.institutions[0].locationAccuracy, 'district-center');
  assert.equal(result.alerts.items.length, 1);
  assert.equal(result.alerts.items[0].title, 'Allowed alert');
});

test('ranking excludes missing values instead of inventing zero', async () => {
  assert.ok(existsSync(serviceUrl), 'src/situation-center/service.ts must exist');
  if (!existsSync(serviceUrl)) return;
  const { createSituationCenterService } = await import('../../src/situation-center/service.js');
  const result = await createSituationCenterService(deps()).buildBootstrap(principal);
  assert.ok(!result.rankings.some((x: any) => x.value === 0 && x.sourceState === 'unavailable'));
  assert.deepEqual(result.rankings, []);
});
