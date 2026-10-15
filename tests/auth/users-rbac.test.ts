import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const typesUrl = new URL('../../src/auth/types.ts', import.meta.url);
const repoUrl = new URL('../../src/users/repository.ts', import.meta.url);

test('enterprise user and role modules exist', () => {
  assert.ok(existsSync(typesUrl), 'src/auth/types.ts must exist');
  assert.ok(existsSync(repoUrl), 'src/users/repository.ts must exist');
});

test('enterprise role set is explicit and stable', async () => {
  if (!existsSync(typesUrl)) return assert.fail('src/auth/types.ts must exist');
  const { ENTERPRISE_ROLES } = await import('../../src/auth/types.js');
  assert.deepEqual(ENTERPRISE_ROLES, [
    'super_admin',
    'executive',
    'regional_specialist',
    'district_manager',
    'institution_manager',
    'viewer'
  ]);
});

test('user repository hydrates scopes and rejects disabled users', async () => {
  if (!existsSync(repoUrl)) return assert.fail('src/users/repository.ts must exist');
  const { createUserRepository } = await import('../../src/users/repository.js');
  const username = 'alice_scope_user';
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const pool = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (/from users/i.test(sql) && /username/i.test(sql)) {
        return { rows: [{ id: 'u1', username, passwordHash: 'scrypt$x$y', role: 'district_manager', isActive: true }] };
      }
      if (/from user_scopes/i.test(sql)) {
        return { rows: [{ districtKey: 'gijduvon', institutionId: null }] };
      }
      return { rows: [] };
    }
  } as any;

  const repo = createUserRepository(pool);
  const user = await repo.findByUsername(username);
  assert.equal(user?.username, username);
  assert.equal(user?.role, 'district_manager');
  assert.deepEqual(user?.scopes, [{ districtKey: 'gijduvon' }]);
  assert.ok(calls.every(call => !call.sql.includes(username)), 'username must be passed as a SQL parameter');

  const disabledPool = {
    async query(sql: string) {
      if (/from users/i.test(sql)) return { rows: [{ id: 'u2', username: 'disabled', passwordHash: 'hash', role: 'viewer', isActive: false }] };
      return { rows: [] };
    }
  } as any;
  assert.equal(await createUserRepository(disabledPool).findByUsername('disabled'), null);
});

test('bootstrap admin is insert-only on duplicate username and returns super_admin principal', async () => {
  if (!existsSync(repoUrl)) return assert.fail('src/users/repository.ts must exist');
  const { createUserRepository } = await import('../../src/users/repository.js');
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const pool = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (/insert into users/i.test(sql)) return { rows: [] };
      if (/from users/i.test(sql)) return { rows: [{ id: 'admin-id', username: 'admin', passwordHash: 'scrypt$aa$bb', role: 'super_admin', isActive: true }] };
      if (/from user_scopes/i.test(sql)) return { rows: [] };
      return { rows: [] };
    }
  } as any;

  const principal = await createUserRepository(pool).ensureBootstrapAdmin({ username: 'admin', passwordHash: 'scrypt$aa$bb' });
  assert.equal(principal.username, 'admin');
  assert.equal(principal.role, 'super_admin');
  const insert = calls.find(call => /insert into users/i.test(call.sql));
  assert.ok(insert);
  assert.match(insert!.sql.toLowerCase(), /on conflict\s*\(username\)\s*do nothing/);
  assert.ok(insert!.values?.includes('scrypt$aa$bb'));
  assert.ok(!insert!.sql.includes('scrypt$aa$bb'), 'password hash must be parameterized');
});
