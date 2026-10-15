import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dashboardHtml } from '../../src/views/dashboard.js';

test('light mode hardening overrides dark Muassasa 360 important styles', () => {
  const html = dashboardHtml();
  const css = readFileSync(new URL('../../public/css/light-mode-hardening.css', import.meta.url), 'utf8');
  assert.match(html, /\/css\/light-mode-hardening\.css\?v=/);
  assert.match(css, /body\[data-view-mode="light"\] \.institution-drawer\s*\{[^}]*background:#f4f7f9!important/s);
  assert.match(css, /body\[data-view-mode="light"\] \.institution-drawer \.metric\s*\{[^}]*background:#fff!important/s);
  assert.match(css, /body\[data-view-mode="light"\] \.institution-drawer \.module-navigation\s*\{[^}]*background:#fff!important/s);
});
