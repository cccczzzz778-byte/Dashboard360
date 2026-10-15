import crypto from 'node:crypto';

export type Session = { username: string; expiresAt: number };

export class SessionManager {
  private sessions = new Map<string, Session>();
  constructor(private ttlMs = 8 * 60 * 60 * 1000) {}
  create(data: { username: string }) {
    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, { username: data.username, expiresAt: Date.now() + this.ttlMs });
    return token;
  }
  get(token: string | undefined) {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) { this.sessions.delete(token); return null; }
    return session;
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
