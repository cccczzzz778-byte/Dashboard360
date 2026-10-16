import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const clientUrl = new URL('../../public/js/situation-institution-3d.js', import.meta.url);
const cssUrl = new URL('../../public/css/situation-institution-3d.css', import.meta.url);
const viewUrl = new URL('../../src/views/situation-center.ts', import.meta.url);

test('situation center loads the enhanced institution 3D map assets', () => {
  assert.ok(existsSync(clientUrl));
  assert.ok(existsSync(cssUrl));
  const view = readFileSync(viewUrl, 'utf8');
  assert.match(view, /situation-institution-3d\.css/);
  assert.match(view, /situation-institution-3d\.js/);
});

test('every institution uses one stylized medical 3D marker with its own status ring', () => {
  const js = readFileSync(clientUrl, 'utf8');
  const css = readFileSync(cssUrl, 'utf8');
  assert.match(js, /function\s+createHospitalMarkerElement\s*\(/);
  assert.match(js, /ssb-hospital-marker-ring/);
  assert.match(js, /ssb-hospital-building/);
  assert.match(js, /syncHospitalMarkers\(layoutInstitutionPositions\(institutions\)\)/);
  assert.match(css, /\.ssb-hospital-marker-ring/);
  assert.match(css, /data-tone=["']red["']/);
  assert.match(css, /#ff5d72/);
  assert.match(css, /#ffc857/);
  assert.match(css, /#2ce7b0/);
});

test('exact institution 3D extrusion is derived from verified coordinates and never claims approximate centers are real footprints', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /visualizationFootprint/);
  assert.match(js, /institutions\.filter\(hasExactLocation\)/);
  assert.match(js, /locationAccuracy/);
  assert.match(js, /Number\.isFinite\(item\?\.longitude\)/);
  assert.match(js, /Number\.isFinite\(item\?\.latitude\)/);
});

test('enhanced map uses Bukhara region camera and refreshes both point and exact 3D building sources', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /BUKHARA_REGION_CAMERA/);
  assert.match(js, /getSource\(['"]institutions-enhanced['"]\)/);
  assert.match(js, /getSource\(['"]institution-buildings['"]\)/);
  assert.match(js, /institutionBuildingCollection\(institutions\)/);
});
