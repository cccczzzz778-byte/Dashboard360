import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const storeUrl = new URL('../../src/auth/session-store.ts', import.meta.url);

test('two SessionStore instances can authenticate the same persisted session', async () => {
  if (!existsSync(storeUrl)) return assert.fail('src/auth/session-store.ts must exist');
  const { SessionStore, hashSessionToken } = await import('../../src/auth/session-store.js');
  const rows = new Map<string, any>();
  const user = { id: 'u1', username: 'admin', passwordHash: 'hash', role: 'super_admin', isActive: true };
  const now = new Date('2026-10-15T09:00:00.000Z');
  const pool = {
    async query(sql: string, values: unknown[] = []) {
      if (/insert into sessions/i.test(sql)) {
        const [tokenHash, userId, csrfToken, _client, expiresAt] = values;
        rows.set(String(tokenHash), { userId, csrfToken, createdAt: now, lastSeenAt: now, expiresAt, revokedAt: null });
        return { rows: [] };
      }
      if (/from sessions/i.test(sql)) {
        const row = rows.get(String(values[0]));
        return { rows: row ? [row] : [] };
      }
      if (/update sessions set last_seen_at/i.test(sql)) {
        const row = rows.get(String(values[0]));
        if (row) row.lastSeenAt = values[1];
        return { rows: [] };
      }
      if (/from users/i.test(sql)) return { rows: String(values[0]) === 'u1' ? [user] : [] };
      if (/from user_scopes/i.test(sql)) return { rows: [] };
      return { rows: [] };
    }
  } as any;

  const replicaA = new SessionStore(pool, { now: () => now });
  const replicaB = new SessionStore(pool, { now: () => now });
  const created = await replicaA.create({ id: 'u1', username: 'admin', role: 'super_admin', scopes: [] });
  assert.equal(rows.has(hashSessionToken(created.token)), true);
  const fromOtherReplica = await replicaB.get(created.token);
  assert.equal(fromOtherReplica?.username, 'admin');
  assert.equal(fromOtherReplica?.role, 'super_admin');
});
