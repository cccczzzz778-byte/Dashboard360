import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import packageJson from '../../package.json' with { type: 'json' };
import { ensureMapLibreVendorAssets } from '../../src/vendor/maplibre-assets.js';

test('maplibre is pinned and copied to same-origin vendor assets', async () => {
  assert.equal((packageJson.dependencies as Record<string,string>)['maplibre-gl'], '6.14.0');
  const root = await mkdtemp(path.join(os.tmpdir(), 'ssb360-maplibre-'));
  await ensureMapLibreVendorAssets(root);
  const vendor = path.join(root, 'public', 'vendor', 'maplibre');
  await stat(path.join(vendor, 'maplibre-gl.css'));
  await stat(path.join(vendor, 'maplibre-gl.mjs'));
  const source = await readFile(path.join(vendor, 'maplibre-gl.mjs'), 'utf8');
  assert.doesNotMatch(source, /https?:\/\//i);
});
