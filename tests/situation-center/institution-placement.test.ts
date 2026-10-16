import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const client = readFileSync(new URL('../../public/js/situation-institution-3d.js', import.meta.url), 'utf8');
const db = readFileSync(new URL('../../src/db/index.ts', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../../src/catalog.ts', import.meta.url), 'utf8');

test('all 23 institutions use one collision-safe 3D marker placement pipeline', () => {
  assert.match(client, /function\s+layoutInstitutionPositions\s*\(/);
  assert.match(client, /syncHospitalMarkers\(layoutInstitutionPositions\(institutions\)\)/);
  assert.match(client, /locationAccuracy\s*===\s*['"]exact['"]/);
  assert.match(client, /displayLongitude/);
  assert.match(client, /displayLatitude/);
  assert.doesNotMatch(client, /id:\s*['"]institution-status-ring['"]/);
  assert.doesNotMatch(client, /id:\s*['"]institution-status-glow['"]/);
});

test('overview is constrained to Bukhara region with presentation-safe fit padding', () => {
  assert.match(client, /BUKHARA_REGION_BOUNDS/);
  assert.match(client, /maxBounds:\s*BUKHARA_REGION_BOUNDS/);
  assert.doesNotMatch(client, /left:\s*340/);
  assert.doesNotMatch(client, /right:\s*340/);
});

test('catalog keeps exactly 23 institutions and supports verified exact locations', () => {
  const ids = [...catalog.matchAll(/(?:districtInstitution|locatedInstitution)\(\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, 23);
  assert.match(catalog, /locatedInstitution\(/);
  assert.match(catalog, /locationAccuracy:\s*['"]exact['"]/);
});

test('database seed can replace old center coordinates with a verified exact catalog location', () => {
  assert.match(db, /excluded\.location_accuracy\s*=\s*'exact'/);
  assert.match(db, /city-center/);
  assert.match(db, /district-center/);
  assert.match(db, /then excluded\.latitude/);
  assert.match(db, /then excluded\.longitude/);
});
