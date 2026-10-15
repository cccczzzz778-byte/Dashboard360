import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJsonSource } from '../../src/connectors/types.js';

test('live adapter returns data with provenance on success', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ score: 82 }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
  try {
    const result = await fetchJsonSource('kpi', 'https://example.test', { validate: (v): v is { score: number } => !!v && typeof (v as any).score === 'number' });
    assert.equal(result.ok, true);
    if (result.ok) { assert.equal(result.data.score, 82); assert.equal(result.source, 'kpi'); assert.ok(result.fetchedAt); }
  } finally { globalThis.fetch = original; }
});

test('live adapter exposes auth_required without leaking credentials', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response('', { status: 401 })) as any;
  try {
    const result = await fetchJsonSource('appeals', 'https://example.test', { token: 'super-secret', validate: (_v): _v is unknown => true });
    assert.deepEqual({ ...(result as any), fetchedAt: 'time' }, { ok: false, code: 'auth_required', fetchedAt: 'time', source: 'appeals' });
    assert.equal(JSON.stringify(result).includes('super-secret'), false);
  } finally { globalThis.fetch = original; }
});

test('malformed payload is unavailable, never zero data', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })) as any;
  try {
    const result = await fetchJsonSource('qr', 'https://example.test', { validate: (v): v is { rating: number } => !!v && !Array.isArray(v) && typeof (v as any).rating === 'number' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'invalid_payload');
    assert.equal(JSON.stringify(result).includes('"rating":0'), false);
  } finally { globalThis.fetch = original; }
});
