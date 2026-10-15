export type IntegrationRunStatus = 'success' | 'degraded' | 'failed' | 'auth_required';
export type IntegrationHealthStatus = 'online' | 'degraded' | 'offline' | 'auth_required' | 'stale' | 'unavailable';

export type FreshnessInput = {
  now?: Date;
  staleAfterMs: number;
  lastStatus: IntegrationRunStatus | null;
  lastSuccessAt: Date | string | null;
};

export type FreshnessResult = {
  status: IntegrationHealthStatus;
  ageMs: number | null;
  stale: boolean;
};

export function evaluateFreshness(input: FreshnessInput): FreshnessResult {
  if (!Number.isFinite(input.staleAfterMs) || input.staleAfterMs <= 0) {
    throw new Error('stale threshold must be greater than zero');
  }
  const now = input.now ?? new Date();
  const success = input.lastSuccessAt ? new Date(input.lastSuccessAt) : null;
  const ageMs = success && Number.isFinite(success.getTime()) ? Math.max(0, now.getTime() - success.getTime()) : null;

  if (input.lastStatus === 'auth_required') return { status: 'auth_required', ageMs, stale: false };
  if (!success || ageMs == null) {
    if (input.lastStatus === 'failed' || input.lastStatus === 'degraded') return { status: 'offline', ageMs: null, stale: false };
    return { status: 'unavailable', ageMs: null, stale: false };
  }
  if (ageMs > input.staleAfterMs) return { status: 'stale', ageMs, stale: true };
  if (input.lastStatus === 'failed' || input.lastStatus === 'degraded') return { status: 'degraded', ageMs, stale: false };
  return { status: 'online', ageMs, stale: false };
}
