import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const clientUrl = new URL('../../public/js/situation-center.js', import.meta.url);
const securityUrl = new URL('../../src/security/http.ts', import.meta.url);
const configUrl = new URL('../../src/situation-center/map-config.ts', import.meta.url);
const operatorMapUrl = new URL('../../public/js/map.js', import.meta.url);

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

test('approved external map style is consumed only through server bootstrap and CSP allowlist', () => {
  const js = readFileSync(clientUrl, 'utf8');
  const security = readFileSync(securityUrl, 'utf8');
  assert.match(js, /bootstrap\.mapStyle|state\.bootstrap\.mapStyle/);
  assert.match(js, /styleUrl/);
  assert.match(security, /SITUATION_MAP_STYLE_ALLOWED_HOSTS/);
  assert.match(security, /connect-src/);
});

test('panels use real values and share district/institution selection state', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /function\s+focusDistrict\s*\(/);
  assert.match(js, /function\s+focusInstitution\s*\(/);
  assert.match(js, /function\s+renderPanels\s*\(/);
  assert.match(js, /situationSummary/);
  assert.match(js, /situationRanking/);
  assert.match(js, /situationAlerts/);
  assert.match(js, /situationActivity/);
  assert.match(js, /\/api\/v1\/situation-center\/trends/);
  assert.match(js, /Ma’lumot yetarli emas/);
  assert.match(js, /360° ochish/);
  assert.doesNotMatch(js, /\|\|\s*0\b/);
});

test('normal dashboard accepts a stable institution deep link for existing 360 drawer', () => {
  const js = readFileSync(operatorMapUrl, 'utf8');
  assert.match(js, /URLSearchParams/);
  assert.match(js, /get\(['"]institution['"]\)/);
  assert.match(js, /SSB360\?\.openInstitution|SSB360\.openInstitution/);
});
