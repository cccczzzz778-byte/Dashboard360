import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dashboardHtml } from '../../src/views/dashboard.js';

const mapCss = readFileSync('public/css/map.css', 'utf8');

test('institutions stay beside the map until narrow mobile widths', () => {
  assert.match(mapCss, /@media\(min-width:761px\) and \(max-width:980px\)\{\.dashboard-grid\{grid-template-columns:minmax\(0,1\.35fr\) minmax\(280px,\.65fr\)\}\}/);
  assert.match(mapCss, /@media\(max-width:760px\)\{\.dashboard-grid\{grid-template-columns:1fr\}\}/);
});

test('map legend institution marker is locally reset from institution card styles', () => {
  const html = dashboardHtml();
  assert.match(html, /legend-dot institution/);
  assert.match(mapCss, /\.map-legend \.legend-dot\.institution\{[^}]*width:8px;[^}]*height:8px;[^}]*padding:0;[^}]*margin:0 5px 0 0;[^}]*border:0;/);
});
