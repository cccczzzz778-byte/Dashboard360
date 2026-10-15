import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardHtml } from '../../src/views/dashboard.js';

test('dashboard exposes persistent night, day and executive TV modes', () => {
  const html = dashboardHtml();
  assert.match(html, /id="viewModeControl"/);
  assert.match(html, /data-view-mode="dark"/);
  assert.match(html, /data-view-mode="light"/);
  assert.match(html, /data-view-mode="tv"/);
  assert.match(html, /\/js\/view-mode\.js\?v=/);
  assert.match(html, /\/css\/view-mode\.css\?v=/);
});
