import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { existsSync } from 'node:fs';
import { SituationCenterError } from '../../src/situation-center/service.js';

const routerUrl = new URL('../../src/situation-center/router.ts', import.meta.url);

function backend() {
  const sessions: Record<string, any> = {
    exec: { userId:'u1', username:'exec', role:'executive', scopes:[], csrfToken:'x' },
    district: { userId:'u2', username:'dist', role:'district_manager', scopes:[{districtKey:'gijduvon'}], csrfToken:'y' }
  };
  return {
    async get(token: string | undefined) { return token ? sessions[token] ?? null : null; },
    async verifyCsrf() { return true; }
  };
}

async function appForTest() {
  assert.ok(existsSync(routerUrl), 'src/situation-center/router.ts must exist');
  const { createSituationCenterRouter } = await import('../../src/situation-center/router.js');
  const app = express();
  app.use('/api/v1/situation-center', createSituationCenterRouter({
    sessionBackend: backend(),
    service: {
      async buildBootstrap(principal: any) { return { generatedAt:'2026-10-15T00:00:00Z', role:principal.role, institutions:[], districts:[], summary:{institutions:0,doctors:null,nurses:null,beds:null,dataCompleteness:null}, rankings:[], alerts:{critical:0,warning:0,items:[]}, integrations:[] }; },
      async buildDistrict(_principal: any, districtKey: string) { return { districtKey }; },
      async buildInstitution(principal: any, id: string) {
        if (principal.role === 'district_manager' && id === 'hidden') throw new SituationCenterError('forbidden');
        return { institution:{ id }, metrics:[] };
      },
      async buildTrend(_principal: any, query: any) { return { metricKey:query.metricKey, items:[] }; }
    } as any
  }));
  return app;
}

test('situation center API requires authentication', async () => {
  if (!existsSync(routerUrl)) return assert.fail('src/situation-center/router.ts must exist');
  const app = await appForTest();
  const res = await request(app).get('/api/v1/situation-center/bootstrap');
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { code:'auth_required' });
});

test('situation center blocks direct-id scope escape', async () => {
  if (!existsSync(routerUrl)) return assert.fail('src/situation-center/router.ts must exist');
  const app = await appForTest();
  const res = await request(app).get('/api/v1/situation-center/institutions/hidden').set('Cookie','ssb360=district');
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'forbidden');
});

test('trend endpoint rejects invalid or unbounded period and empty series invents nothing', async () => {
  if (!existsSync(routerUrl)) return assert.fail('src/situation-center/router.ts must exist');
  const app = await appForTest();
  await request(app).get('/api/v1/situation-center/trends?metricKey=kpi.score').set('Cookie','ssb360=exec').expect(400);
  await request(app).get('/api/v1/situation-center/trends?metricKey=kpi.score&from=2025-01-01&to=2026-12-31').set('Cookie','ssb360=exec').expect(400);
  const empty = await request(app).get('/api/v1/situation-center/trends?metricKey=kpi.score&from=2026-10-01&to=2026-10-15').set('Cookie','ssb360=exec').expect(200);
  assert.deepEqual(empty.body.items, []);
});
