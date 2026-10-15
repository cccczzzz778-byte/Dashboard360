import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { SessionManager, hashPassword, verifyPassword } from '../../src/auth/session.js';
import { createServer } from '../../src/app.js';

test('password hashing verifies correct password and rejects wrong password', async () => {
  const hash = await hashPassword('S3cret!');
  assert.equal(await verifyPassword('S3cret!', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
  assert.equal(hash.includes('S3cret!'), false);
});

test('session expires and no longer authenticates', async () => {
  const manager = new SessionManager(1);
  const token = manager.create({ username: 'admin' });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(manager.get(token), null);
});

test('protected API returns safe auth_required state without secrets', async () => {
  const app = createServer({ sessionManager: new SessionManager() });
  const res = await request(app).get('/api/institutions?district=buxoro-shahar').expect(401);
  assert.deepEqual(res.body, { code: 'auth_required' });
  assert.equal(JSON.stringify(res.body).includes(process.env.ADMIN_PASSWORD ?? '__never__'), false);
});

test('login route does not render password or secret environment values', async () => {
  const old = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'VERY_SECRET_PASSWORD';
  try {
    const res = await request(createServer()).get('/login').expect(200);
    assert.equal(res.text.includes('VERY_SECRET_PASSWORD'), false);
  } finally { process.env.ADMIN_PASSWORD = old; }
});
