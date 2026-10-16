import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const clientUrl = new URL('../../public/js/situation-institution-3d.js', import.meta.url);
const cssUrl = new URL('../../public/css/situation-institution-3d.css', import.meta.url);

test('enhanced situation map keeps a visible safety basemap under remote vector layers', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /function\s+addSafetyBasemap\s*\(/);
  assert.match(js, /ssb-safety-basemap/);
  assert.match(js, /https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(js, /addSafetyBasemap\(map\)/);
});

test('province view shows a screen-space medical 3D marker for each institution', () => {
  const js = readFileSync(clientUrl, 'utf8');
  const css = readFileSync(cssUrl, 'utf8');
  assert.match(js, /function\s+syncHospitalMarkers\s*\(/);
  assert.match(js, /new\s+maplibregl\.Marker/);
  assert.match(js, /ssb-hospital-marker/);
  assert.match(js, /dataset\.tone/);
  assert.match(css, /\.ssb-hospital-marker/);
  assert.match(css, /\.ssb-hospital-building/);
  assert.match(css, /transform:\s*rotateX\(/);
});
