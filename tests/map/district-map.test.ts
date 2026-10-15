import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDistrictName, isKnownDistrict } from '../../src/map/district-map.js';

test('normalizes district name spelling and apostrophe variants', () => {
  assert.equal(normalizeDistrictName("G'ijduvon tumani"), 'gijduvon');
  assert.equal(normalizeDistrictName('G‘ijduvon'), 'gijduvon');
  assert.equal(normalizeDistrictName('Qoravulbozor tumani'), 'qorovulbozor');
  assert.equal(normalizeDistrictName('Qorovulbozor'), 'qorovulbozor');
  assert.equal(normalizeDistrictName("Qorako'l tumani"), 'qorakol');
});

test('recognizes Buxoro city and Kogon city distinctly from districts', () => {
  assert.equal(normalizeDistrictName('Buxoro shahri'), 'buxoro-shahar');
  assert.equal(normalizeDistrictName('Buxoro tumani'), 'buxoro-tumani');
  assert.equal(normalizeDistrictName('Kogon shahri'), 'kogon-shahar');
  assert.equal(normalizeDistrictName('Kogon tumani'), 'kogon-tumani');
  assert.equal(isKnownDistrict('Vobkent tumani'), true);
});
