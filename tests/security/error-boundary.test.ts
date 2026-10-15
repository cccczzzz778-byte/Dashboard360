import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { requestContext, safeErrorHandler, apiNotFound } from '../../src/security/errors.js';

test('request context assigns a bounded server request id', async () => {
  const app = express();
  app.use(requestContext);
  app.get('/ok', (_req, res) => res.json({ ok: true }));
  const result = await request(app).get('/ok').expect(200);
  assert.match(result.headers['x-request-id'] ?? '', /^[0-9a-f-]{36}$/);
});

test('API error boundary returns generic response without stack or secret message', async () => {
  const app = express();
  app.use(requestContext);
  app.get('/api/fail', () => { throw new Error('DATABASE_URL=secret-internal-value'); });
  app.use(safeErrorHandler);
  const result = await request(app).get('/api/fail').expect(500);
  assert.equal(result.body.code, 'internal_error');
  assert.ok(result.body.requestId);
  assert.equal(JSON.stringify(result.body).includes('secret-internal-value'), false);
  assert.equal(JSON.stringify(result.body).includes('Error:'), false);
});

test('unknown API routes return JSON 404 instead of implementation details', async () => {
  const app = express();
  app.use(requestContext);
  app.use('/api', apiNotFound);
  const result = await request(app).get('/api/missing').expect(404);
  assert.deepEqual(result.body.code, 'not_found');
  assert.ok(result.body.requestId);
});
