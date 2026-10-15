import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { existsSync } from 'node:fs';

const routerUrl = new URL('../../src/enterprise/router.ts', import.meta.url);

const institutions = [
  { id: 'inst-gij', officialName: 'Gijduvon TTB', type: 'TTB', districtKey: 'gijduvon', address: null, leaderName: null, phone: null, latitude: null, longitude: null },
  { id: 'inst-olot', officialName: 'Olot TTB', type: 'TTB', districtKey: 'olot', address: null, leaderName: null, phone: null, latitude: null, longitude: null }
];

function backend() {
  const sessions: Record<string, any> = {
    exec: { userId: 'u-exec', username: 'exec', role: 'executive', scopes: [], csrfToken: 'csrf-exec' },
    district: { userId: 'u-dist', username: 'dist', role: 'district_manager', scopes: [{ districtKey: 'gijduvon' }], csrfToken: 'csrf-dist' }
  };
  return {
    async get(token: string | undefined) { return token ? sessions[token] ?? null : null; },
    async verifyCsrf(token: string | undefined, candidate: string | undefined) { return Boolean(token && sessions[token]?.csrfToken === candidate); }
  };
}

async function buildApp(options: { executiveToday?: { build(principal: any): Promise<unknown> } } = {}) {
  if (!existsSync(routerUrl)) throw new Error('src/enterprise/router.ts must exist');
  const { createEnterpriseRouter } = await import('../../src/enterprise/router.js');
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createEnterpriseRouter({
    sessionBackend: backend(),
    institutions: {
      async listAll() { return institutions; },
      async findById(id: string) { return institutions.find(x => x.id === id) ?? null; }
    },
    risk: {
      async listLatest() { return [
        { id: 1, institutionId: 'inst-gij', score: 82, severity: 'red', coveragePct: 75, calculatedAt: '2026-10-15T10:00:00Z', factors: [] },
        { id: 2, institutionId: 'inst-olot', score: 20, severity: 'green', coveragePct: 90, calculatedAt: '2026-10-15T10:00:00Z', factors: [] }
      ]; },
      async latest(id: string) { return id === 'inst-gij' ? { id: 1, institutionId: id, score: 82, severity: 'red', coveragePct: 75, calculatedAt: '2026-10-15T10:00:00Z', factors: [] } : null; }
    },
    alerts: {
      async listActive() { return [
        { id: 1, institutionId: 'inst-gij', sourceKey: null, alertType: 'risk', severity: 'critical', title: 'Risk', reason: '82', dedupKey: 'risk:inst-gij', metadata: {}, status: 'open', firstSeenAt: null, lastSeenAt: null },
        { id: 2, institutionId: 'inst-olot', sourceKey: null, alertType: 'risk', severity: 'warning', title: 'Risk', reason: '55', dedupKey: 'risk:inst-olot', metadata: {}, status: 'open', firstSeenAt: null, lastSeenAt: null },
        { id: 3, institutionId: null, sourceKey: 'qr', alertType: 'integration', severity: 'warning', title: 'QR', reason: 'stale', dedupKey: 'integration:qr:stale', metadata: {}, status: 'open', firstSeenAt: null, lastSeenAt: null }
      ]; }
    },
    integrations: {
      async listHealth() { return [{ key: 'qr', label: 'QR', enabled: true, authState: 'configured', status: 'stale', lastSuccessAt: null, lastRunAt: null, latencyMs: null, errorCode: null, staleAfterSeconds: 3600, ageMs: null }]; }
    },
    executiveToday: options.executiveToday
  }));
  return app;
}

test('enterprise v1 router exists and unauthenticated requests return 401', async () => {
  assert.ok(existsSync(routerUrl), 'src/enterprise/router.ts must exist');
  if (!existsSync(routerUrl)) return;
  const app = await buildApp();
  const res = await request(app).get('/api/v1/risk');
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { code: 'auth_required' });
});

test('district scope filters risk and alerts and blocks direct-ID access outside scope', async () => {
  if (!existsSync(routerUrl)) return assert.fail('src/enterprise/router.ts must exist');
  const app = await buildApp();
  const risk = await request(app).get('/api/v1/risk').set('Cookie', 'ssb360=district');
  assert.equal(risk.status, 200);
  assert.deepEqual(risk.body.items.map((x: any) => x.institutionId), ['inst-gij']);

  const blocked = await request(app).get('/api/v1/risk/inst-olot').set('Cookie', 'ssb360=district');
  assert.equal(blocked.status, 403);

  const alerts = await request(app).get('/api/v1/alerts').set('Cookie', 'ssb360=district');
  assert.equal(alerts.status, 200);
  assert.deepEqual(alerts.body.items.map((x: any) => x.id), [1]);
});

test('missing risk returns explicit unavailable state with zero coverage, not fabricated score', async () => {
  if (!existsSync(routerUrl)) return assert.fail('src/enterprise/router.ts must exist');
  const app = await buildApp();
  const res = await request(app).get('/api/v1/risk/inst-olot').set('Cookie', 'ssb360=exec');
  assert.equal(res.status, 200);
  assert.equal(res.body.risk.score, null);
  assert.equal(res.body.risk.severity, 'unavailable');
  assert.equal(res.body.risk.coveragePct, 0);
});

test('integration health requires integrations permission and executive can read valid payload', async () => {
  if (!existsSync(routerUrl)) return assert.fail('src/enterprise/router.ts must exist');
  const app = await buildApp();
  const denied = await request(app).get('/api/v1/integrations/health').set('Cookie', 'ssb360=district');
  assert.equal(denied.status, 403);
  const allowed = await request(app).get('/api/v1/integrations/health').set('Cookie', 'ssb360=exec');
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.items[0].status, 'stale');
});

test('executive today endpoint is explicit not_ready until a service is supplied', async () => {
  if (!existsSync(routerUrl)) return assert.fail('src/enterprise/router.ts must exist');
  const app = await buildApp();
  const res = await request(app).get('/api/v1/executive/today').set('Cookie', 'ssb360=exec');
  assert.equal(res.status, 503);
  assert.deepEqual(res.body, { code: 'not_ready' });
});

test('executive today endpoint delegates to supplied scoped aggregate service', async () => {
  if (!existsSync(routerUrl)) return assert.fail('src/enterprise/router.ts must exist');
  let actorRole = '';
  const app = await buildApp({
    executiveToday: {
      async build(principal) {
        actorRole = principal.role;
        return { generatedAt: '2026-10-15T10:05:00.000Z', summary: { institutions: 2 }, topAttention: [] };
      }
    }
  });
  const res = await request(app).get('/api/v1/executive/today').set('Cookie', 'ssb360=exec');
  assert.equal(res.status, 200);
  assert.equal(actorRole, 'executive');
  assert.equal(res.body.summary.institutions, 2);
});
