import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const clientUrl = new URL('../../public/js/situation-center.js', import.meta.url);
const configUrl = new URL('../../src/situation-center/map-config.ts', import.meta.url);

test('client provides safe WebGL fallback, fullscreen and read-only 20s presentation mode', () => {
  assert.ok(existsSync(clientUrl));
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /function\s+supportsWebGL\s*\(/);
  assert.match(js, /function\s+toggleFullscreen\s*\(/);
  assert.match(js, /function\s+startPresentation\s*\([^)]*20000/);
  assert.match(js, /function\s+stopPresentation\s*\(/);
  assert.match(js, /situationFallback/);
  assert.match(js, /pointerdown|pointerup/);
  assert.match(js, /keydown/);
  assert.doesNotMatch(js, /fetch\([^\n]+method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
});

test('map style configuration fails closed unless HTTPS host is explicitly allowlisted', async () => {
  assert.ok(existsSync(configUrl));
  const { resolveMapStyle } = await import('../../src/situation-center/map-config.js');
  assert.deepEqual(resolveMapStyle({ url:'http://bad.example/style.json', allowedHosts:['bad.example'] }), { external:false, styleUrl:null });
  assert.deepEqual(resolveMapStyle({ url:'https://unknown.example/style.json', allowedHosts:['approved.example'] }), { external:false, styleUrl:null });
  const allowed = resolveMapStyle({ url:'https://approved.example/style.json', allowedHosts:['approved.example'] });
  assert.equal(allowed.external, true);
  assert.equal(allowed.styleUrl, 'https://approved.example/style.json');
});
