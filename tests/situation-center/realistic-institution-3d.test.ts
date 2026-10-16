import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const clientUrl = new URL('../../public/js/situation-institution-3d.js', import.meta.url);

test('institution 3D markers use realistic medical-building dimensions instead of giant towers', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.doesNotMatch(js, /VISUAL_HEIGHT_METERS\s*=\s*900/);
  assert.match(js, /function\s+institutionVisualHeight\s*\(/);
  assert.match(js, /18/);
  assert.match(js, /24/);
  assert.match(js, /30/);
  assert.match(js, /BUILDING_HALF_WIDTH\s*=\s*0\.00018/);
  assert.match(js, /BUILDING_HALF_HEIGHT\s*=\s*0\.00011/);
});

test('3D institution buildings appear only after useful zoom while status rings remain visible province-wide', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /id:\s*'institution-buildings-3d'[\s\S]*minzoom:\s*11\.5/);
  assert.match(js, /id:\s*'institution-status-ring'[\s\S]*source:\s*'institutions-enhanced'/);
  assert.match(js, /zoom:\s*Math\.max\(state\.map\.getZoom\(\),\s*15\.2\)/);
});

test('enhanced map also extrudes real vector building geometry when the style provides it', () => {
  const js = readFileSync(clientUrl, 'utf8');
  assert.match(js, /function\s+addNativeBuildingExtrusion\s*\(/);
  assert.match(js, /'source-layer':\s*'building'/);
  assert.match(js, /fill-extrusion-height/);
  assert.match(js, /addNativeBuildingExtrusion\(map\)/);
});
