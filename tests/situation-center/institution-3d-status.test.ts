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

test('institution map renders a stylized 3D building and status rings for every institution', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /function\s+institutionBuildingCollection\s*\(/);
  assert.match(js, /institution-buildings/);
  assert.match(js, /institution-buildings-3d/);
  assert.match(js, /fill-extrusion/);
  assert.match(js, /institution-status-ring/);
  assert.match(js, /institution-status-glow/);
  assert.match(js, /#ff5d72/);
  assert.match(js, /#ffc857/);
  assert.match(js, /#2ce7b0/);
});

test('institution 3D layer is derived from institution coordinates and never claims to be a real footprint', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /visualizationFootprint/);
  assert.match(js, /locationAccuracy/);
  assert.match(js, /Number\.isFinite\(item\.longitude\)/);
  assert.match(js, /Number\.isFinite\(item\.latitude\)/);
});

test('enhanced map uses Bukhara region camera and refreshes both point and 3D building sources', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /BUKHARA_REGION_CAMERA/);
  assert.match(js, /getSource\(['"]institutions-enhanced['"]\)/);
  assert.match(js, /getSource\(['"]institution-buildings['"]\)/);
  assert.match(js, /institutionBuildingCollection\(institutions\)/);
});
