import test from 'node:test';
import assert from 'node:assert/strict';
import { LoginRateLimiter } from '../../src/security/rate-limit.js';
import { RedisLoginRateLimiter, type RedisCounterClient } from '../../src/security/redis-rate-limit.js';

class FakeRedis implements RedisCounterClient {
  private counts = new Map<string, number>();
  private expires = new Map<string, number>();
  constructor(private now = 1_000_000) {}

  async sendCommand(args: string[]): Promise<unknown> {
    const op = args[0]?.toUpperCase();
    const key = args[1];
    if (op === 'GET') return String(this.counts.get(key) ?? 0);
    if (op === 'PTTL') return Math.max(0, (this.expires.get(key) ?? this.now) - this.now);
    if (op === 'DEL') { this.counts.delete(key); this.expires.delete(key); return 1; }
    if (op === 'EVAL') {
      const evalKey = args[3];
      const windowMs = Number(args[4]);
      const next = (this.counts.get(evalKey) ?? 0) + 1;
      this.counts.set(evalKey, next);
      if (next === 1) this.expires.set(evalKey, this.now + windowMs);
      return next;
    }
    throw new Error(`unsupported ${op}`);
  }
}

class BrokenRedis implements RedisCounterClient {
  async sendCommand(): Promise<unknown> { throw new Error('redis unavailable'); }
}

test('redis login limiter shares failed-attempt threshold across replicas', async () => {
  const redis = new FakeRedis();
  const replicaA = new RedisLoginRateLimiter(redis, new LoginRateLimiter(), 5, 15 * 60 * 1000);
  const replicaB = new RedisLoginRateLimiter(redis, new LoginRateLimiter(), 5, 15 * 60 * 1000);

  for (let i = 0; i < 3; i++) await replicaA.fail('10.0.0.5', 'Admin');
  for (let i = 0; i < 2; i++) await replicaB.fail('10.0.0.5', 'admin');

  const blocked = await replicaA.check('10.0.0.5', 'ADMIN');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test('redis login limiter fails safely to in-memory protection when redis is unavailable', async () => {
  const limiter = new RedisLoginRateLimiter(new BrokenRedis(), new LoginRateLimiter(2, 60_000, 60_000), 2, 60_000);
  await limiter.fail('10.0.0.9', 'admin');
  await limiter.fail('10.0.0.9', 'admin');
  const blocked = await limiter.check('10.0.0.9', 'admin');
  assert.equal(blocked.allowed, false);
});

test('successful login clears shared redis failure counter', async () => {
  const redis = new FakeRedis();
  const limiter = new RedisLoginRateLimiter(redis, new LoginRateLimiter(), 2, 60_000);
  await limiter.fail('10.0.0.3', 'admin');
  await limiter.fail('10.0.0.3', 'admin');
  assert.equal((await limiter.check('10.0.0.3', 'admin')).allowed, false);
  await limiter.success('10.0.0.3', 'admin');
  assert.equal((await limiter.check('10.0.0.3', 'admin')).allowed, true);
});
