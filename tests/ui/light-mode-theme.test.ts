import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('public/css/view-mode.css', 'utf8');

test('light mode renders a complete high-contrast white dashboard including Muassasa 360', () => {
  assert.match(css, /body\[data-view-mode="light"\]\s*\{[^}]*background:#f7f9fc/i);
  assert.match(css, /body\[data-view-mode="light"\] \.workspace\s*\{[^}]*background:#f7f9fc/i);
  assert.match(css, /body\[data-view-mode="light"\] \.institution-drawer\s*\{[^}]*background:#f7f9fc!important/i);
  assert.match(css, /body\[data-view-mode="light"\] \.institution-drawer \.drawer-topbar[^}]*background:#ffffff!important/i);
  assert.match(css, /body\[data-view-mode="light"\] \.institution-drawer \.module-navigation[^}]*background:#ffffff!important/i);
  assert.match(css, /body\[data-view-mode="light"\] \.institution-drawer \.module-workspace[^}]*background:#f7f9fc!important/i);
  assert.match(css, /body\[data-view-mode="light"\] \.institution-drawer \.metric[^}]*background:#ffffff!important/i);
  assert.match(css, /body\[data-view-mode="light"\] \.institution-drawer \.metric \.value[^}]*color:#102a3a!important/i);
});
