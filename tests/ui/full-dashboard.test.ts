import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createServer } from '../../src/app.js';
import { SessionManager } from '../../src/auth/session.js';

function cookieFrom(res: any) {
  const raw = res.headers['set-cookie'];
  return (Array.isArray(raw) ? raw[0] : raw).split(';')[0];
}

test('full dashboard exposes map, catalog, 360 modules and integrations without fake metrics', async () => {
  const oldU = process.env.ADMIN_USERNAME;
  const oldP = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'secret';
  try {
    const app = createServer({ sessionManager: new SessionManager() });
    const login = await request(app).post('/login').type('form').send({ username: 'admin', password: 'secret' }).expect(302);
    const cookie = cookieFrom(login);

    const page = await request(app).get('/').set('Cookie', cookie).expect(200);
    assert.match(page.text, /id="buxoroMap"/);
    assert.match(page.text, /id="institutionDrawer"/);
    assert.match(page.text, /Rahbar nazorati/);

    const bootstrap = await request(app).get('/api/bootstrap').set('Cookie', cookie).expect(200);
    assert.equal(bootstrap.body.districts.length, 13);
    assert.ok(bootstrap.body.institutions.length >= 20);
    assert.ok(bootstrap.body.modules.length >= 25);
    assert.ok(bootstrap.body.integrations.length >= 6);

    const institutions = await request(app).get('/api/institutions?district=buxoro-shahar').set('Cookie', cookie).expect(200);
    assert.ok(institutions.body.length >= 1);

    await request(app).get('/css/app.css').expect(200);
    await request(app).get('/js/map.js').expect(200);
  } finally {
    process.env.ADMIN_USERNAME = oldU;
    process.env.ADMIN_PASSWORD = oldP;
  }
});
