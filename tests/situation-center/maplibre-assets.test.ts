import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const packageUrl = new URL('../../package.json', import.meta.url);
const helperUrl = new URL('../../src/vendor/maplibre-assets.ts', import.meta.url);

test('MapLibre is pinned and self-host asset helper exists', async () => {
  const pkg = JSON.parse(readFileSync(packageUrl, 'utf8'));
  assert.equal(pkg.dependencies?.['maplibre-gl'], '6.14.0');
  assert.ok(existsSync(helperUrl), 'src/vendor/maplibre-assets.ts must exist');
});

test('MapLibre helper copies ESM runtime assets locally without CDN references', async () => {
  assert.ok(existsSync(helperUrl), 'src/vendor/maplibre-assets.ts must exist');
  if (!existsSync(helperUrl)) return;
  const { ensureMapLibreVendorAssets } = await import('../../src/vendor/maplibre-assets.js');
  const root = mkdtempSync(join(tmpdir(), 'ssb360-maplibre-'));
  await ensureMapLibreVendorAssets(root);
  const base = join(root, 'public', 'vendor', 'maplibre');
  for (const name of ['maplibre-gl.css', 'maplibre-gl.mjs', 'maplibre-gl-csp-worker.js', 'shared.js']) {
    assert.ok(existsSync(join(base, name)), `${name} must be copied`);
  }
  const js = readFileSync(join(base, 'maplibre-gl.mjs'), 'utf8');
  assert.doesNotMatch(js, /unpkg\.com|cdn\.jsdelivr\.net/i);
});
