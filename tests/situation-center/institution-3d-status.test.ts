import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const clientUrl = new URL('../../public/js/situation-center.js', import.meta.url);

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

test('map data refresh updates both point markers and 3D building source', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /getSource\(['"]institutions['"]\)/);
  assert.match(js, /getSource\(['"]institution-buildings['"]\)/);
  assert.match(js, /institutionBuildingCollection\(institutions\)/);
});
