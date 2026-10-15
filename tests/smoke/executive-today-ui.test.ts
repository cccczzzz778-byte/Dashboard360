import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dashboardHtml } from '../../src/views/dashboard.js';

const viewUrl = new URL('../../src/views/executive-today.ts', import.meta.url);
const jsUrl = new URL('../../public/js/executive-today.js', import.meta.url);
const cssUrl = new URL('../../public/css/executive-today.css', import.meta.url);

test('executive today UI assets exist', () => {
  assert.ok(existsSync(viewUrl), 'src/views/executive-today.ts must exist');
  assert.ok(existsSync(jsUrl), 'public/js/executive-today.js must exist');
  assert.ok(existsSync(cssUrl), 'public/css/executive-today.css must exist');
});

test('dashboard exposes Bugun navigation and executive section while preserving map and 360 contracts', () => {
  const html = dashboardHtml();
  assert.match(html, /data-target="executiveTodaySection"/);
  assert.match(html, /id="executiveTodaySection"/);
  assert.match(html, /id="mapSection"/);
  assert.match(html, /Muassasa 360°/);
  assert.match(html, /\/css\/executive-today\.css/);
  assert.match(html, /\/js\/executive-today\.js/);
  assert.doesNotMatch(html, /data-executive-value="[0-9]+"/, 'server shell must not inject fake executive metrics');
});

test('executive client reads only enterprise today endpoint and renders loading, no-data and error states safely', () => {
  if (!existsSync(jsUrl)) return assert.fail('public/js/executive-today.js must exist');
  const js = readFileSync(jsUrl, 'utf8');
  assert.match(js, /\/api\/v1\/executive\/today/);
  assert.match(js, /textContent/);
  assert.match(js, /N\/A|Ma.?lumot yo.?q/);
  assert.match(js, /Yuklan|loading/i);
  assert.match(js, /Xatolik|error/i);
  assert.doesNotMatch(js, /innerHTML\s*=\s*[^'"`]/, 'API text must not be injected as raw HTML');
});

test('executive styles support dark, light and TV view modes and responsive layout', () => {
  if (!existsSync(cssUrl)) return assert.fail('public/css/executive-today.css must exist');
  const css = readFileSync(cssUrl, 'utf8');
  assert.match(css, /executive-today/);
  assert.match(css, /data-view-mode="light"/);
  assert.match(css, /data-view-mode="tv"/);
  assert.match(css, /@media/);
});
