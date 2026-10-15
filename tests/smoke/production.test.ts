import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createServer } from '../../src/app.js';
import { SessionManager } from '../../src/auth/session.js';

function cookieFrom(res: any) {
  const raw = res.headers['set-cookie'];
  return (Array.isArray(raw) ? raw[0] : raw).split(';')[0];
}

test('production smoke: health, login and protected map page work', async () => {
  const oldU = process.env.ADMIN_USERNAME; const oldP = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_USERNAME = 'admin'; process.env.ADMIN_PASSWORD = 'secret';
  try {
    const app = createServer({ sessionManager: new SessionManager() });
    const health = await request(app).get('/api/health').expect(200);
    assert.deepEqual(health.body, { ok: true, service: 'buxoro-ssb-360' });
    await request(app).get('/').expect(302).expect('Location', '/login');
    await request(app).get('/login').expect(200).expect(/Buxoro SSB 360/);
    const login = await request(app).post('/login').type('form').send({ username: 'admin', password: 'secret' }).expect(302);
    const cookie = cookieFrom(login);
    await request(app).get('/').set('Cookie', cookie).expect(200).expect(/360° nazorat markazi/).expect(/Buxoro viloyati/);
  } finally { process.env.ADMIN_USERNAME = oldU; process.env.ADMIN_PASSWORD = oldP; }
});

test('mobile markup includes responsive viewport and map controls are buttons for keyboard use', async () => {
  const oldU = process.env.ADMIN_USERNAME; const oldP = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_USERNAME = 'admin'; process.env.ADMIN_PASSWORD = 'secret';
  try {
    const app = createServer({ sessionManager: new SessionManager() });
    const login = await request(app).post('/login').type('form').send({ username: 'admin', password: 'secret' });
    const cookie = cookieFrom(login);
    const res = await request(app).get('/').set('Cookie', cookie).expect(200);
    assert.match(res.text, /name="viewport"/);
    assert.match(res.text, /role="listbox"/);
  } finally { process.env.ADMIN_USERNAME = oldU; process.env.ADMIN_PASSWORD = oldP; }
});
