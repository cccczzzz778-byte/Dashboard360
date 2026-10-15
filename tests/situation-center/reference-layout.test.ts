import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viewUrl = new URL('../../src/views/situation-center.ts', import.meta.url);
const cssUrl = new URL('../../public/css/situation-reference.css', import.meta.url);
const clientUrl = new URL('../../public/js/situation-reference.js', import.meta.url);

test('reference layout exposes centered title, risk donut and today activity panels', () => {
  const view = readFileSync(viewUrl, 'utf8');
  assert.match(view, /class=\"situation-title-center\"/);
  assert.match(view, /id=\"situationRiskDistribution\"/);
  assert.match(view, /id=\"situationToday\"/);
  assert.match(view, /Bugungi qabul/);
  assert.match(view, /\/css\/situation-reference\.css/);
  assert.match(view, /\/js\/situation-reference\.js/);
});

test('reference layout renders risk distribution and today activity without fabricated values', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /function\s+renderRiskDistribution\s*\(/);
  assert.match(js, /conic-gradient/);
  assert.match(js, /function\s+renderToday\s*\(/);
  assert.match(js, /Bugungi qabul/);
  assert.match(js, /Manba ulanmagan|N\/A/);
  assert.doesNotMatch(js, /today(?:Visits|Admissions)\s*\|\|\s*0/);
});

test('reference layout keeps title visually centered and four right-side HUD blocks inside the viewport', () => {
  const css = readFileSync(cssUrl, 'utf8');
  assert.match(css, /\.situation-title-center\s*\{[^}]*position\s*:\s*absolute[^}]*left\s*:\s*50%[^}]*transform\s*:\s*translateX\(-50%\)/is);
  assert.match(css, /\.situation-right\s*\{[^}]*grid-template-rows\s*:[^;}]*repeat\(4/is);
  assert.match(css, /\.sc-risk-donut/is);
  assert.match(css, /\.sc-today-number/is);
});
