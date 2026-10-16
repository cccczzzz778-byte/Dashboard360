import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = readFileSync(new URL('../../src/catalog.ts', import.meta.url), 'utf8');
const db = readFileSync(new URL('../../src/db/index.ts', import.meta.url), 'utf8');
const map = readFileSync(new URL('../../public/js/situation-institution-3d.js', import.meta.url), 'utf8');

test('verified facilities use exact coordinates instead of the shared city centroid', () => {
  assert.match(catalog, /shtb-buxoro[\s\S]*39\.7448[\s\S]*64\.44251[\s\S]*locationAccuracy:\s*'exact'/);
  assert.match(catalog, /shtb-kogon[\s\S]*39\.728586[\s\S]*64\.545346[\s\S]*locationAccuracy:\s*'exact'/);
});

test('schema upgrades old centroid coordinates when catalog location becomes exact', () => {
  assert.match(db, /excluded\.location_accuracy\s*=\s*'exact'/);
  assert.match(db, /institutions\.location_accuracy\s+in\s*\([^)]*'city-center'[^)]*'district-center'/);
  assert.match(db, /latitude\s*=\s*case/i);
  assert.match(db, /longitude\s*=\s*case/i);
});

test('province overview does not pretend approximate district centers are 3D facilities', () => {
  assert.match(map, /function\s+hasExactLocation\s*\(/);
  assert.match(map, /institutions\.filter\(hasExactLocation\)/);
  assert.doesNotMatch(map, /padding:\s*\{\s*top:\s*115,\s*bottom:\s*70,\s*left:\s*340,\s*right:\s*340\s*\}/);
  assert.match(map, /pitch:\s*24/);
});
