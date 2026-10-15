import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type { EnterpriseRole, UserAccount, UserPrincipal, UserScope } from '../auth/types.js';

type UserRow = {
  id: string;
  username: string;
  passwordHash: string;
  role: EnterpriseRole;
  isActive: boolean;
};

type ScopeRow = {
  districtKey: string | null;
  institutionId: string | null;
};

async function loadScopes(pool: Pool, userId: string): Promise<UserScope[]> {
  const result = await pool.query<ScopeRow>(
    `select district_key as "districtKey", institution_id as "institutionId"
       from user_scopes where user_id = $1 order by id`,
    [userId]
  );
  return result.rows.map(row => ({
    ...(row.districtKey ? { districtKey: row.districtKey } : {}),
    ...(row.institutionId ? { institutionId: row.institutionId } : {})
  }));
}

async function accountFromRow(pool: Pool, row: UserRow | undefined): Promise<UserAccount | null> {
  if (!row || !row.isActive) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    role: row.role,
    isActive: row.isActive,
    scopes: await loadScopes(pool, row.id)
  };
}

export function createUserRepository(pool: Pool) {
  return {
    async findByUsername(username: string): Promise<UserAccount | null> {
      const result = await pool.query<UserRow>(
        `select id, username, password_hash as "passwordHash", role, is_active as "isActive"
           from users where username = $1 limit 1`,
        [username]
      );
      return accountFromRow(pool, result.rows[0]);
    },

    async findPrincipalById(id: string): Promise<UserPrincipal | null> {
      const result = await pool.query<UserRow>(
        `select id, username, password_hash as "passwordHash", role, is_active as "isActive"
           from users where id = $1 limit 1`,
        [id]
      );
      const account = await accountFromRow(pool, result.rows[0]);
      if (!account) return null;
      const { passwordHash: _passwordHash, isActive: _isActive, ...principal } = account;
      return principal;
    },

    async ensureBootstrapAdmin(input: { username: string; passwordHash: string }): Promise<UserPrincipal> {
      const id = crypto.randomUUID();
      await pool.query(
        `insert into users(id, username, password_hash, role, is_active)
         values($1,$2,$3,'super_admin',true)
         on conflict(username) do nothing`,
        [id, input.username, input.passwordHash]
      );
      const account = await this.findByUsername(input.username);
      if (!account) throw new Error('bootstrap_admin_unavailable');
      const { passwordHash: _passwordHash, isActive: _isActive, ...principal } = account;
      return principal;
    }
  };
}
