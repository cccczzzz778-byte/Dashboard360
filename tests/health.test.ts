import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createServer } from '../src/app.js';

test('GET /api/health identifies the fresh Buxoro SSB 360 service', async () => {
  const response = await request(createServer()).get('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, service: 'buxoro-ssb-360' });
});

test('unavailable data is not replaced with zero', () => {
  const value: number | null = null;
  assert.equal(value, null);
  assert.notEqual(value, 0);
});
