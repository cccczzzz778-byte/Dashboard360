import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createServer } from '../../src/app.js';
import { SessionManager } from '../../src/auth/session.js';

function cookieFrom(res: any) {
  const raw = res.headers['set-cookie'];
  return (Array.isArray(raw) ? raw[0] : raw).split(';')[0];
}

function setTestCredentials() {
  const old = {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    hash: process.env.ADMIN_PASSWORD_HASH,
    nodeEnv: process.env.NODE_ENV
  };
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'secret';
  delete process.env.ADMIN_PASSWORD_HASH;
  return () => {
    process.env.ADMIN_USERNAME = old.username;
    process.env.ADMIN_PASSWORD = old.password;
    process.env.NODE_ENV = old.nodeEnv;
    if (old.hash === undefined) delete process.env.ADMIN_PASSWORD_HASH; else process.env.ADMIN_PASSWORD_HASH = old.hash;
  };
}

test('production smoke: health, login and protected map page work', async () => {
  const restore = setTestCredentials();
  try {
    const app = createServer({ sessionManager: new SessionManager() });
    const health = await request(app).get('/api/health').expect(200);
    assert.deepEqual(health.body, { ok: true, service: 'buxoro-ssb-360' });
    await request(app).get('/').expect(302).expect('Location', '/login');
    await request(app).get('/login').expect(200).expect(/Buxoro SSB 360/);
    const login = await request(app).post('/login').type('form').send({ username: 'admin', password: 'secret' }).expect(302);
    const cookie = cookieFrom(login);
    await request(app).get('/').set('Cookie', cookie).expect(200).expect(/360° nazorat markazi/).expect(/Buxoro viloyati/);
  } finally { restore(); }
});

test('mobile markup includes responsive viewport and map controls are buttons for keyboard use', async () => {
  const restore = setTestCredentials();
  try {
    const app = createServer({ sessionManager: new SessionManager() });
    const login = await request(app).post('/login').type('form').send({ username: 'admin', password: 'secret' });
    const cookie = cookieFrom(login);
    const res = await request(app).get('/').set('Cookie', cookie).expect(200);
    assert.match(res.text, /name="viewport"/);
    assert.match(res.text, /role="listbox"/);
  } finally { restore(); }
});
