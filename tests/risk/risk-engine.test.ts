import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const engineUrl = new URL('../../src/risk/engine.ts', import.meta.url);

test('risk engine exists', () => {
  assert.ok(existsSync(engineUrl), 'src/risk/engine.ts must exist');
});

test('all missing factors produce unavailable risk, never a fabricated zero score', async () => {
  if (!existsSync(engineUrl)) return assert.fail('src/risk/engine.ts must exist');
  const { calculateRisk } = await import('../../src/risk/engine.js');
  const result = calculateRisk([
    { key: 'kpi', weight: 2, normalizedRisk: null, sourceState: 'unavailable' },
    { key: 'staff', weight: 1, normalizedRisk: null, sourceState: 'error' }
  ]);
  assert.equal(result.score, null);
  assert.equal(result.severity, 'unavailable');
  assert.equal(result.coveragePct, 0);
});

test('risk score is weighted only across available factors while coverage uses all configured weights', async () => {
  if (!existsSync(engineUrl)) return assert.fail('src/risk/engine.ts must exist');
  const { calculateRisk } = await import('../../src/risk/engine.js');
  const result = calculateRisk([
    { key: 'kpi', weight: 2, normalizedRisk: 80, sourceState: 'live' },
    { key: 'staff', weight: 1, normalizedRisk: null, sourceState: 'unavailable' }
  ]);
  assert.equal(result.score, 80);
  assert.equal(result.severity, 'red');
  assert.equal(result.coveragePct, 66.67);
  assert.equal(result.factors.find((x: any) => x.key === 'kpi')?.contribution, 80);
  assert.equal(result.factors.find((x: any) => x.key === 'staff')?.contribution, null);
});

test('risk thresholds are exact and normalized inputs are bounded to 0..100', async () => {
  if (!existsSync(engineUrl)) return assert.fail('src/risk/engine.ts must exist');
  const { calculateRisk } = await import('../../src/risk/engine.js');
  assert.equal(calculateRisk([{ key: 'x', weight: 1, normalizedRisk: 39, sourceState: 'live' }]).severity, 'green');
  assert.equal(calculateRisk([{ key: 'x', weight: 1, normalizedRisk: 40, sourceState: 'live' }]).severity, 'amber');
  assert.equal(calculateRisk([{ key: 'x', weight: 1, normalizedRisk: 69, sourceState: 'live' }]).severity, 'amber');
  assert.equal(calculateRisk([{ key: 'x', weight: 1, normalizedRisk: 70, sourceState: 'live' }]).severity, 'red');
  assert.equal(calculateRisk([{ key: 'x', weight: 1, normalizedRisk: 999, sourceState: 'live' }]).score, 100);
  assert.equal(calculateRisk([{ key: 'x', weight: 1, normalizedRisk: -5, sourceState: 'live' }]).score, 0);
  assert.throws(() => calculateRisk([{ key: 'x', weight: 0, normalizedRisk: 10, sourceState: 'live' }]), /weight/i);
});
