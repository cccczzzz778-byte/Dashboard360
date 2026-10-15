import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditRecorder, sanitizeAuditMetadata } from '../../src/audit/store.js';

class FakePool {
  calls: Array<{ sql: string; values?: unknown[] }> = [];
  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, values });
    return { rows: [] } as any;
  }
}

test('audit metadata removes credential-like fields and bounds values', () => {
  const sanitized = sanitizeAuditMetadata({
    username: 'admin',
    password: 'do-not-store',
    csrfToken: 'csrf-secret',
    sessionToken: 'session-secret',
    cookie: 'cookie-secret',
    authorization: 'Bearer secret',
    metricKey: 'kpi.score',
    note: 'x'.repeat(900)
  });
  assert.equal(sanitized.username, 'admin');
  assert.equal(sanitized.metricKey, 'kpi.score');
  assert.equal('password' in sanitized, false);
  assert.equal('csrfToken' in sanitized, false);
  assert.equal('sessionToken' in sanitized, false);
  assert.equal('cookie' in sanitized, false);
  assert.equal('authorization' in sanitized, false);
  assert.equal(String(sanitized.note).length, 500);
});

test('audit recorder persists sanitized event metadata using parameters', async () => {
  const pool = new FakePool();
  const recorder = createAuditRecorder(pool as any);
  await recorder.record('metric_upsert', {
    username: 'admin',
    client: 'fingerprint123',
    institutionId: 'inst-1',
    metricKey: 'kpi.score',
    password: 'never-store-me'
  });

  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].sql, /insert into audit_events/i);
  const values = pool.calls[0].values ?? [];
  assert.equal(values[0], 'metric_upsert');
  assert.equal(values[1], 'admin');
  assert.equal(values[2], 'fingerprint123');
  assert.equal(JSON.stringify(values).includes('never-store-me'), false);
});

test('audit recorder never breaks the request path when database audit write fails', async () => {
  const pool = { async query() { throw new Error('db unavailable'); } };
  const recorder = createAuditRecorder(pool as any);
  await assert.doesNotReject(() => recorder.record('login', { username: 'admin' }));
});
