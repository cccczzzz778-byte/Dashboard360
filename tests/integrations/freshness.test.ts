import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const freshnessUrl = new URL('../../src/integrations/freshness.ts', import.meta.url);

test('integration freshness module exists', () => {
  assert.ok(existsSync(freshnessUrl), 'src/integrations/freshness.ts must exist');
});

test('freshness distinguishes never-seen, auth, offline, degraded, stale and online', async () => {
  if (!existsSync(freshnessUrl)) return assert.fail('src/integrations/freshness.ts must exist');
  const { evaluateFreshness } = await import('../../src/integrations/freshness.js');
  const now = new Date('2026-10-15T10:00:00Z');
  const base = { now, staleAfterMs: 60 * 60 * 1000 };

  assert.equal(evaluateFreshness({ ...base, lastStatus: null, lastSuccessAt: null }).status, 'unavailable');
  assert.equal(evaluateFreshness({ ...base, lastStatus: 'auth_required', lastSuccessAt: null }).status, 'auth_required');
  assert.equal(evaluateFreshness({ ...base, lastStatus: 'failed', lastSuccessAt: null }).status, 'offline');
  assert.equal(evaluateFreshness({ ...base, lastStatus: 'failed', lastSuccessAt: new Date('2026-10-15T09:45:00Z') }).status, 'degraded');
  assert.equal(evaluateFreshness({ ...base, lastStatus: 'degraded', lastSuccessAt: new Date('2026-10-15T09:45:00Z') }).status, 'degraded');
  assert.equal(evaluateFreshness({ ...base, lastStatus: 'success', lastSuccessAt: new Date('2026-10-15T08:00:00Z') }).status, 'stale');
  assert.equal(evaluateFreshness({ ...base, lastStatus: 'success', lastSuccessAt: new Date('2026-10-15T09:45:00Z') }).status, 'online');
});

test('future timestamps and invalid stale thresholds fail safely', async () => {
  if (!existsSync(freshnessUrl)) return assert.fail('src/integrations/freshness.ts must exist');
  const { evaluateFreshness } = await import('../../src/integrations/freshness.js');
  const now = new Date('2026-10-15T10:00:00Z');
  assert.equal(evaluateFreshness({ now, staleAfterMs: 1000, lastStatus: 'success', lastSuccessAt: new Date('2026-10-15T10:01:00Z') }).status, 'online');
  assert.throws(() => evaluateFreshness({ now, staleAfterMs: 0, lastStatus: 'success', lastSuccessAt: now }), /stale/i);
});
