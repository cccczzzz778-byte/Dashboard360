import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const clientUrl = new URL('../../public/js/situation-center.js', import.meta.url);
const securityUrl = new URL('../../src/security/http.ts', import.meta.url);
const configUrl = new URL('../../src/situation-center/map-config.ts', import.meta.url);

test('maplibre client is self-hosted, risk-null-safe and labels coordinate accuracy', () => {
  assert.ok(existsSync(clientUrl), 'public/js/situation-center.js must exist');
  assert.ok(existsSync(configUrl), 'src/situation-center/map-config.ts must exist');
  if (!existsSync(clientUrl)) return;
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /\/vendor\/maplibre\/maplibre-gl\.mjs/);
  assert.match(js, /setWorkerUrl\(['"]\/vendor\/maplibre\/maplibre-gl-worker\.mjs['"]\)/);
  assert.match(js, /\/api\/v1\/situation-center\/bootstrap/);
  assert.match(js, /unavailable[^\n]{0,80}neutral|neutral[^\n]{0,80}unavailable/);
  assert.match(js, /locationAccuracy/);
  assert.match(js, /tile\.openstreetmap\.org/);
  assert.match(js, /pitch\s*:\s*(5[0-9]|60)/);
  assert.doesNotMatch(js, /unpkg|jsdelivr|cdnjs/i);
});

test('CSP permits same-origin MapLibre worker and OSM tile fetches without third-party script/style CDN', () => {
  const source = readFileSync(securityUrl, 'utf8');
  assert.match(source, /worker-src\s+'self'/);
  assert.match(source, /connect-src\s+'self'[^;]*https:\/\/\*\.tile\.openstreetmap\.org/);
  assert.doesNotMatch(source, /script-src[^;]*(?:unpkg|jsdelivr|cdnjs)/i);
  assert.doesNotMatch(source, /style-src[^;]*(?:unpkg|jsdelivr|cdnjs)/i);
});
