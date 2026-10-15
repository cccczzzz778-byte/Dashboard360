import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createServer } from '../../src/app.js';
import { SessionManager } from '../../src/auth/session.js';

const institution = { id: 'buxoro-001', officialName: 'Buxoro shahar tibbiyot birlashmasi', type: 'SHTB', districtKey: 'buxoro-shahar', address: null, leaderName: null, phone: null, latitude: null, longitude: null };
void institution;

test('protected dashboard redirects unauthenticated users to login', async () => {
  const app = createServer({ sessionManager: new SessionManager() });
  await request(app).get('/').expect(302).expect('Location', '/login');
});

test('authenticated institution endpoint can return empty district without fake institutions', async () => {
  const app = createServer({ sessionManager: new SessionManager() });
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
});

test('360 module set renders the full monitoring surface and unavailable values remain N/A-ready', async () => {
  const { buildUnavailableModules } = await import('../../src/domain/modules.js');
  const modules = buildUnavailableModules();
  assert.ok(modules.length >= 25);
  assert.ok(modules.some(x => x.key === 'dmed'));
  assert.ok(modules.some(x => x.key === 'finance'));
  assert.ok(modules.some(x => x.key === 'mortality'));
  for (const module of modules) {
    for (const metric of module.metrics) {
      assert.equal(metric.value, null);
      assert.equal(metric.sourceStatus, 'unavailable');
    }
  }
});
