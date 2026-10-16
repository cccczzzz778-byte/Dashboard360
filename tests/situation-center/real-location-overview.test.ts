import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = readFileSync(new URL('../../src/catalog.ts', import.meta.url), 'utf8');
const db = readFileSync(new URL('../../src/db/index.ts', import.meta.url), 'utf8');
const map = readFileSync(new URL('../../public/js/situation-institution-3d.js', import.meta.url), 'utf8');

test('verified facilities use exact coordinates instead of the shared city centroid', () => {
  assert.match(catalog, /const\s+locatedInstitution[\s\S]*locationAccuracy:\s*'exact'/);
  assert.match(catalog, /locatedInstitution\('shtb-buxoro'[\s\S]*39\.7448[\s\S]*64\.44251/);
  assert.match(catalog, /locatedInstitution\('shtb-kogon'[\s\S]*39\.728586[\s\S]*64\.545346/);
});

test('schema upgrades old centroid coordinates when catalog location becomes exact', () => {
  assert.match(db, /excluded\.location_accuracy\s*=\s*'exact'/);
  assert.match(db, /institutions\.location_accuracy='unknown'/);
  assert.match(db, /institutions\.location_accuracy\s+in\s*\(\s*'city-center'\s*,\s*'district-center'\s*\)/);
  assert.match(db, /latitude\s*=\s*case/i);
  assert.match(db, /longitude\s*=\s*case/i);
});

test('province overview keeps approximate centers honest and never turns them into invented map positions', () => {
  assert.match(map, /function\s+hasExactLocation\s*\(/);
  assert.match(map, /institutions\.filter\(hasExactLocation\)/);
  assert.match(map, /function\s+sharedAnchorGroups\s*\(/);
  assert.doesNotMatch(map, /APPROXIMATE_DISPLAY_RADIUS/);
  assert.doesNotMatch(map, /displayLongitude/);
  assert.doesNotMatch(map, /displayLatitude/);
  assert.doesNotMatch(map, /Math\.cos\(angle\)/);
  assert.doesNotMatch(map, /Math\.sin\(angle\)/);
  assert.match(map, /pitch:\s*20/);
});
