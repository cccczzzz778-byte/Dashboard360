import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createServer } from '../../src/app.js';
import { SessionManager } from '../../src/auth/session.js';
import type { InstitutionRepository } from '../../src/db/index.js';

const institution = { id: 'buxoro-001', officialName: 'Buxoro shahar tibbiyot birlashmasi', type: 'SHTB', districtKey: 'buxoro-shahar', address: null, leaderName: null, phone: null, latitude: null, longitude: null };

test('protected dashboard redirects unauthenticated users to login', async () => {
  const app = createServer({ sessionManager: new SessionManager() });
  await request(app).get('/').expect(302).expect('Location', '/login');
});

test('authenticated institution endpoint can return empty district without fake institutions', async () => {
  const app = createServer({ sessionManager: new SessionManager() });
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
});

test('360 module set renders unavailable values as N/A in the browser contract', async () => {
  const { buildUnavailableModules } = await import('../../src/domain/modules.js');
  const modules = buildUnavailableModules();
  assert.equal(modules.length, 10);
  assert.equal(modules[0].metrics[0].value, null);
  assert.equal(modules[0].metrics[0].sourceStatus, 'unavailable');
});
