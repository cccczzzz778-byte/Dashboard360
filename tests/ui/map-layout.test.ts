import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dashboardHtml } from '../../src/views/dashboard.js';

const appCss = readFileSync('public/css/app.css', 'utf8');
const mapCss = readFileSync('public/css/map.css', 'utf8');

test('institutions stay beside the map until narrow mobile widths', () => {
  assert.doesNotMatch(appCss, /@media\(max-width:980px\)\{[^}]*\.dashboard-grid[^}]*grid-template-columns:1fr/);
  assert.match(appCss, /@media\(max-width:760px\)\{[^}]*\.dashboard-grid\{grid-template-columns:1fr\}/);
});

test('map legend institution marker cannot inherit institution card styles', () => {
  const html = dashboardHtml();
  assert.match(html, /legend-dot institution-legend/);
  assert.doesNotMatch(html, /legend-dot institution\b/);
  assert.match(mapCss, /\.legend-dot\.institution-legend\{background:#4ca4ff\}/);
});
