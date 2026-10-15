import crypto from 'node:crypto';

export type SessionRole = 'admin' | 'viewer';
export type Session = {
  username: string;
  role: SessionRole;
  csrfToken: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
};

export class SessionManager {
  private sessions = new Map<string, Session>();
  private idleTtlMs: number;

  constructor(private ttlMs = 8 * 60 * 60 * 1000, idleTtlMs = 30 * 60 * 1000) {
    this.idleTtlMs = Math.min(idleTtlMs, ttlMs);
  }

  create(data: { username: string; role?: SessionRole }) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    this.sessions.set(token, {
      username: data.username,
      role: data.role ?? 'viewer',
      csrfToken: crypto.randomBytes(32).toString('hex'),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + this.ttlMs
    });
    return token;
  }

  get(token: string | undefined) {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    const now = Date.now();
    if (session.expiresAt <= now || session.lastSeenAt + this.idleTtlMs <= now) {
      this.sessions.delete(token);
      return null;
    }
    session.lastSeenAt = now;
    return session;
  }

  verifyCsrf(token: string | undefined, candidate: string | undefined) {
    if (!token || !candidate) return false;
    const session = this.get(token);
    if (!session) return false;
    const expected = Buffer.from(session.csrfToken);
    const supplied = Buffer.from(candidate);
    return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
  }

  destroy(token: string) { this.sessions.delete(token); }
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const derived = await new Promise<Buffer>((resolve, reject) => crypto.scrypt(password, salt, 64, (e, k) => e ? reject(e) : resolve(k as Buffer)));
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algo, saltHex, hashHex] = encoded.split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const derived = await new Promise<Buffer>((resolve, reject) => crypto.scrypt(password, Buffer.from(saltHex, 'hex'), 64, (e, k) => e ? reject(e) : resolve(k as Buffer)));
  const stored = Buffer.from(hashHex, 'hex');
  return stored.length === derived.length && crypto.timingSafeEqual(stored, derived);
}
