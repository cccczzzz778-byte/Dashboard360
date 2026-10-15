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

test('production responses expose hardened browser security headers', async () => {
  const oldNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await request(createServer()).get('/login').expect(200);
    assert.match(res.headers['strict-transport-security'] ?? '', /max-age=/);
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['cross-origin-opener-policy'], 'same-origin');
    assert.equal(res.headers['cross-origin-resource-policy'], 'same-origin');
    assert.doesNotMatch(res.headers['content-security-policy'] ?? '', /script-src[^;]*'unsafe-inline'/);
  } finally {
    process.env.NODE_ENV = oldNodeEnv;
  }
});

test('sessions carry a CSRF token and validate it', () => {
  const sessions = new SessionManager();
  const token = sessions.create({ username: 'admin', role: 'admin' });
  const session = sessions.get(token);
  assert.ok(session?.csrfToken);
  assert.equal(sessions.verifyCsrf(token, session!.csrfToken), true);
  assert.equal(sessions.verifyCsrf(token, 'wrong-token'), false);
});

test('authenticated admin write is rejected without CSRF token', async () => {
  const restore = setTestCredentials();
  try {
    const app = createServer({ sessionManager: new SessionManager() });
    const login = await request(app).post('/login').type('form').send({ username: 'admin', password: 'secret' }).expect(302);
    const cookie = cookieFrom(login);
    await request(app).post('/api/admin/metrics').set('Cookie', cookie).send({}).expect(403);
  } finally { restore(); }
});

test('login attempts are throttled after repeated failures', async () => {
  const restore = setTestCredentials();
  try {
    const app = createServer({ sessionManager: new SessionManager() });
    for (let i = 0; i < 5; i++) {
      await request(app).post('/login').type('form').send({ username: 'admin', password: 'wrong' }).expect(401);
    }
    const blocked = await request(app).post('/login').type('form').send({ username: 'admin', password: 'wrong' }).expect(429);
    assert.ok(Number(blocked.headers['retry-after']) > 0);
  } finally { restore(); }
});
