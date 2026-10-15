import crypto from 'node:crypto';
import { LoginRateLimiter, type LoginLimiter, type RateLimitCheck } from './rate-limit.js';

export type RedisCounterClient = {
  sendCommand(args: string[]): Promise<unknown>;
};

const incrementScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

function normalizeIdentity(ip: string, username: string) {
  return `${ip || 'unknown'}|${username.trim().toLowerCase().slice(0, 120)}`;
}

export function redisLoginKey(ip: string, username: string) {
  const digest = crypto.createHash('sha256').update(normalizeIdentity(ip, username)).digest('hex');
  return `ssb360:login:${digest}`;
}

export class RedisLoginRateLimiter implements LoginLimiter {
  constructor(
    private redis: RedisCounterClient,
    private fallback = new LoginRateLimiter(),
    private maxFailures = 5,
    private windowMs = 15 * 60 * 1000
  ) {}

  async check(ip: string, username: string, now = Date.now()): Promise<RateLimitCheck> {
    const local = this.fallback.check(ip, username, now);
    if (!local.allowed) return local;
    const key = redisLoginKey(ip, username);
    try {
      const [rawCount, rawTtl] = await Promise.all([
        this.redis.sendCommand(['GET', key]),
        this.redis.sendCommand(['PTTL', key])
      ]);
      const count = Number(rawCount ?? 0);
      const ttl = Number(rawTtl ?? 0);
      if (Number.isFinite(count) && count >= this.maxFailures && ttl > 0) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)) };
      }
      return local;
    } catch {
      return local;
    }
  }

  async fail(ip: string, username: string, now = Date.now()): Promise<void> {
    this.fallback.fail(ip, username, now);
    const key = redisLoginKey(ip, username);
    try {
      await this.redis.sendCommand(['EVAL', incrementScript, '1', key, String(this.windowMs)]);
    } catch {
      // Local limiter remains active when Redis is unavailable.
    }
  }

  async success(ip: string, username: string): Promise<void> {
    this.fallback.success(ip, username);
    try {
      await this.redis.sendCommand(['DEL', redisLoginKey(ip, username)]);
    } catch {
      // Successful login must not fail because Redis is unavailable.
    }
  }
}
