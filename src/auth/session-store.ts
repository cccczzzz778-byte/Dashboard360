import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type { UserPrincipal } from './types.js';
import { createUserRepository } from '../users/repository.js';

export type PersistedSession = {
  userId: string;
  username: string;
  role: UserPrincipal['role'];
  scopes: UserPrincipal['scopes'];
  csrfToken: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
};

export type SessionStoreOptions = {
  ttlMs?: number;
  idleTtlMs?: number;
  now?: () => Date;
};

type SessionRow = {
  userId: string;
  csrfToken: string;
  createdAt: Date | string;
  lastSeenAt: Date | string;
  expiresAt: Date | string;
  revokedAt: Date | string | null;
};

export function hashSessionToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function constantTimeStringEqual(expected: string, supplied: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export class SessionStore {
  private ttlMs: number;
  private idleTtlMs: number;
  private now: () => Date;
  private users: ReturnType<typeof createUserRepository>;

  constructor(private pool: Pool, options: SessionStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? 8 * 60 * 60 * 1000;
    this.idleTtlMs = Math.min(options.idleTtlMs ?? 30 * 60 * 1000, this.ttlMs);
    this.now = options.now ?? (() => new Date());
    this.users = createUserRepository(pool);
  }

  async create(principal: UserPrincipal, metadata: { clientFingerprint?: string | null } = {}) {
    const token = crypto.randomBytes(36).toString('base64url');
    const csrfToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashSessionToken(token);
    const now = this.now();
    const expiresAt = new Date(now.getTime() + this.ttlMs);

    await this.pool.query(
      `insert into sessions(token_hash, user_id, csrf_token, client_fingerprint, created_at, last_seen_at, expires_at)
       values($1,$2,$3,$4,now(),now(),$5)`,
      [tokenHash, principal.id, csrfToken, metadata.clientFingerprint ?? null, expiresAt]
    );

    return { token, csrfToken, expiresAt };
  }

  async get(token: string | undefined): Promise<PersistedSession | null> {
    if (!token) return null;
    const tokenHash = hashSessionToken(token);
    const result = await this.pool.query<SessionRow>(
      `select user_id as "userId", csrf_token as "csrfToken", created_at as "createdAt",
              last_seen_at as "lastSeenAt", expires_at as "expiresAt", revoked_at as "revokedAt"
         from sessions where token_hash = $1 limit 1`,
      [tokenHash]
    );
    const row = result.rows[0];
    if (!row) return null;

    const now = this.now();
    const createdAt = new Date(row.createdAt);
    const lastSeenAt = new Date(row.lastSeenAt);
    const expiresAt = new Date(row.expiresAt);
    const revokedAt = row.revokedAt ? new Date(row.revokedAt) : null;
    const idleExpired = lastSeenAt.getTime() + this.idleTtlMs <= now.getTime();
    const absoluteExpired = expiresAt.getTime() <= now.getTime();

    if (revokedAt || idleExpired || absoluteExpired) {
      if (!revokedAt) {
        await this.pool.query(
          `update sessions set revoked_at = coalesce(revoked_at, $2) where token_hash = $1`,
          [tokenHash, now]
        );
      }
      return null;
    }

    const principal = await this.users.findPrincipalById(row.userId);
    if (!principal) {
      await this.pool.query(
        `update sessions set revoked_at = coalesce(revoked_at, $2) where token_hash = $1`,
        [tokenHash, now]
      );
      return null;
    }

    await this.pool.query(`update sessions set last_seen_at = $2 where token_hash = $1`, [tokenHash, now]);
    return {
      userId: principal.id,
      username: principal.username,
      role: principal.role,
      scopes: principal.scopes,
      csrfToken: row.csrfToken,
      createdAt,
      lastSeenAt: now,
      expiresAt
    };
  }

  async verifyCsrf(token: string | undefined, candidate: string | undefined) {
    if (!token || !candidate) return false;
    const session = await this.get(token);
    if (!session) return false;
    return constantTimeStringEqual(session.csrfToken, candidate);
  }

  async revoke(token: string) {
    const tokenHash = hashSessionToken(token);
    await this.pool.query(
      `update sessions set revoked_at = coalesce(revoked_at, $2) where token_hash = $1`,
      [tokenHash, this.now()]
    );
  }

  async revokeAllForUser(userId: string) {
    await this.pool.query(
      `update sessions set revoked_at = coalesce(revoked_at, $2) where user_id = $1 and revoked_at is null`,
      [userId, this.now()]
    );
  }
}
