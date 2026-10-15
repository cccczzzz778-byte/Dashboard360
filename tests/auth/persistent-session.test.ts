import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const storeUrl = new URL('../../src/auth/session-store.ts', import.meta.url);

type SessionRow = {
  tokenHash: string;
  userId: string;
  csrfToken: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

class FakePool {
  sessions = new Map<string, SessionRow>();
  users = new Map([['u1', { id: 'u1', username: 'admin', passwordHash: 'hash', role: 'super_admin', isActive: true }]]);
  scopes = new Map<string, Array<{ districtKey: string | null; institutionId: string | null }>>([['u1', []]]);
  rawInsertedValues: unknown[][] = [];

  async query(sql: string, values: unknown[] = []) {
    if (/insert into sessions/i.test(sql)) {
      this.rawInsertedValues.push(values);
      const [tokenHash, userId, csrfToken, client, expiresAt] = values as [string, string, string, string | null, Date];
      const now = new Date(Number((expiresAt as Date).getTime()) - 8 * 60 * 60 * 1000);
      this.sessions.set(tokenHash, { tokenHash, userId, csrfToken, createdAt: now, lastSeenAt: now, expiresAt, revokedAt: null });
      return { rows: [] };
    }
    if (/from sessions/i.test(sql)) {
      const row = this.sessions.get(String(values[0]));
      return { rows: row ? [{ userId: row.userId, csrfToken: row.csrfToken, createdAt: row.createdAt, lastSeenAt: row.lastSeenAt, expiresAt: row.expiresAt, revokedAt: row.revokedAt }] : [] };
    }
    if (/update sessions set last_seen_at/i.test(sql)) {
      const row = this.sessions.get(String(values[0]));
      if (row) row.lastSeenAt = values[1] as Date;
      return { rows: [] };
    }
    if (/update sessions set revoked_at/i.test(sql)) {
      const tokenHash = String(values[0]);
      const row = this.sessions.get(tokenHash);
      if (row) row.revokedAt = new Date();
      return { rows: [] };
    }
    if (/from users/i.test(sql)) {
      const user = this.users.get(String(values[0]));
      return { rows: user ? [user] : [] };
    }
    if (/from user_scopes/i.test(sql)) return { rows: this.scopes.get(String(values[0])) ?? [] };
    return { rows: [] };
  }
}

test('persistent session store exists', () => {
  assert.ok(existsSync(storeUrl), 'src/auth/session-store.ts must exist');
});

test('session token is opaque and only its SHA-256 hash is persisted', async () => {
  if (!existsSync(storeUrl)) return assert.fail('src/auth/session-store.ts must exist');
  const { SessionStore, hashSessionToken } = await import('../../src/auth/session-store.js');
  const pool = new FakePool();
  const now = new Date('2026-10-15T08:00:00.000Z');
  const store = new SessionStore(pool as any, { now: () => now });
  const created = await store.create({ id: 'u1', username: 'admin', role: 'super_admin', scopes: [] });

  assert.equal(created.token.length >= 48, true);
  assert.notEqual(created.token, hashSessionToken(created.token));
  assert.equal(pool.sessions.has(hashSessionToken(created.token)), true);
  assert.equal(pool.rawInsertedValues.some(values => values.includes(created.token)), false, 'raw session token must never be persisted');
  assert.ok(created.csrfToken.length >= 32);
});

test('expired idle revoked and unknown sessions are rejected while active session refreshes last seen', async () => {
  if (!existsSync(storeUrl)) return assert.fail('src/auth/session-store.ts must exist');
  const { SessionStore, hashSessionToken } = await import('../../src/auth/session-store.js');
  const pool = new FakePool();
  let now = new Date('2026-10-15T08:00:00.000Z');
  const store = new SessionStore(pool as any, { now: () => now, ttlMs: 8 * 60 * 60 * 1000, idleTtlMs: 30 * 60 * 1000 });
  const created = await store.create({ id: 'u1', username: 'admin', role: 'super_admin', scopes: [] });

  now = new Date('2026-10-15T08:10:00.000Z');
  const active = await store.get(created.token);
  assert.equal(active?.username, 'admin');
  assert.equal(active?.role, 'super_admin');
  assert.equal(active?.lastSeenAt.toISOString(), now.toISOString());
  assert.equal(await store.verifyCsrf(created.token, created.csrfToken), true);
  assert.equal(await store.verifyCsrf(created.token, 'wrong'), false);

  const key = hashSessionToken(created.token);
  pool.sessions.get(key)!.lastSeenAt = new Date('2026-10-15T07:00:00.000Z');
  assert.equal(await store.get(created.token), null, 'idle-expired session must fail');

  const second = await store.create({ id: 'u1', username: 'admin', role: 'super_admin', scopes: [] });
  await store.revoke(second.token);
  assert.equal(await store.get(second.token), null, 'revoked session must fail');
  assert.equal(await store.get('unknown-token'), null);
});
