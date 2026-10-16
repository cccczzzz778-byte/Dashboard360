import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = readFileSync(new URL('../../src/catalog.ts', import.meta.url), 'utf8');
const map = readFileSync(new URL('../../public/js/situation-institution-3d.js', import.meta.url), 'utf8');

test('verified Bukhara facilities use their mapped hospital coordinates', () => {
  assert.match(catalog, /locatedInstitution\('ttb-buxoro'[\s\S]*39\.86029[\s\S]*64\.45487/);
  assert.match(catalog, /locatedInstitution\('ttb-gijduvon'[\s\S]*40\.11057[\s\S]*64\.68125/);
  assert.match(catalog, /locatedInstitution\('ttb-jondor'[\s\S]*39\.7375[\s\S]*64\.17572/);
  assert.match(catalog, /locatedInstitution\('ttb-vobkent'[\s\S]*40\.02497[\s\S]*64\.52473/);
  assert.match(catalog, /locatedInstitution\('oits-buxoro'[\s\S]*39\.81081[\s\S]*64\.42658/);
});

test('all facilities render as individual 3D markers while shared approximate anchors stay geographically honest', () => {
  assert.match(map, /function\s+sharedAnchorGroups\s*\(/);
  assert.match(map, /function\s+visualOffsetForSharedAnchor\s*\(/);
  assert.match(map, /\.setLngLat\(\[item\.longitude,\s*item\.latitude\]\)/);
  assert.match(map, /--marker-offset-x/);
  assert.match(map, /--marker-offset-y/);
  assert.doesNotMatch(map, /ssb-hospital-count/);
  assert.doesNotMatch(map, /displayLongitude/);
  assert.doesNotMatch(map, /displayLatitude/);
});

test('province reset keeps the presentation on Bukhara Region', () => {
  assert.match(map, /BUKHARA_REGION_BOUNDS/);
  assert.match(map, /function\s+resetProvinceView\s*\(/);
  assert.match(map, /fitBounds\(BUKHARA_REGION_BOUNDS/);
  assert.match(map, /Viloyat/);
});
