import test from 'node:test';
import assert from 'node:assert/strict';
import { checkReadiness } from '../../src/health/readiness.js';

test('readiness is healthy when required database and configured redis respond', async () => {
  const result = await checkReadiness({
    database: async () => true,
    redis: async () => true
  }, 100);
  assert.deepEqual(result, { ok: true, database: true, redis: true });
});

test('readiness is unhealthy when database fails', async () => {
  const result = await checkReadiness({
    database: async () => { throw new Error('db down'); },
    redis: async () => true
  }, 100);
  assert.deepEqual(result, { ok: false, database: false, redis: true });
});

test('redis is optional when not configured but required when configured', async () => {
  const withoutRedis = await checkReadiness({ database: async () => true }, 100);
  assert.deepEqual(withoutRedis, { ok: true, database: true, redis: null });

  const brokenRedis = await checkReadiness({
    database: async () => true,
    redis: async () => false
  }, 100);
  assert.deepEqual(brokenRedis, { ok: false, database: true, redis: false });
});

test('dependency checks time out instead of hanging readiness forever', async () => {
  const result = await checkReadiness({
    database: () => new Promise<boolean>(() => {})
  }, 10);
  assert.equal(result.ok, false);
  assert.equal(result.database, false);
});
