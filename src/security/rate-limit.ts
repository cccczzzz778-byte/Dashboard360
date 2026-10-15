type LoginAttempt = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
};

export type RateLimitCheck = { allowed: boolean; retryAfterSeconds: number };

export type LoginLimiter = {
  check(ip: string, username: string, now?: number): RateLimitCheck | Promise<RateLimitCheck>;
  fail(ip: string, username: string, now?: number): void | Promise<void>;
  success(ip: string, username: string): void | Promise<void>;
};

export class LoginRateLimiter implements LoginLimiter {
  private attempts = new Map<string, LoginAttempt>();

  constructor(
    private maxFailures = 5,
    private windowMs = 15 * 60 * 1000,
    private blockMs = 15 * 60 * 1000
  ) {}

  private key(ip: string, username: string) {
    return `${ip || 'unknown'}|${username.trim().toLowerCase().slice(0, 120)}`;
  }

  private current(key: string, now: number) {
    const entry = this.attempts.get(key);
    if (!entry) return null;
    if (entry.blockedUntil > now) return entry;
    if (now - entry.windowStartedAt >= this.windowMs) {
      this.attempts.delete(key);
      return null;
    }
    return entry;
  }

  check(ip: string, username: string, now = Date.now()): RateLimitCheck {
    const entry = this.current(this.key(ip, username), now);
    if (!entry || entry.blockedUntil <= now) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)) };
  }

  fail(ip: string, username: string, now = Date.now()) {
    const key = this.key(ip, username);
    const existing = this.current(key, now);
    const next: LoginAttempt = existing ?? { failures: 0, windowStartedAt: now, blockedUntil: 0 };
    next.failures += 1;
    if (next.failures >= this.maxFailures) next.blockedUntil = now + this.blockMs;
    this.attempts.set(key, next);
    this.compact(now);
  }

  success(ip: string, username: string) {
    this.attempts.delete(this.key(ip, username));
  }

  private compact(now: number) {
    if (this.attempts.size < 5000) return;
    for (const [key, entry] of this.attempts) {
      if (entry.blockedUntil <= now && now - entry.windowStartedAt >= this.windowMs) this.attempts.delete(key);
    }
  }
}
