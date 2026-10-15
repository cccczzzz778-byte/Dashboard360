import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { dashboardHtml } from '../../src/views/dashboard.js';
import { createServer } from '../../src/app.js';

test('dashboard loads Leaflet from self-hosted vendor path, never a third-party script CDN', () => {
  const html = dashboardHtml();
  assert.match(html, /\/vendor\/leaflet\/leaflet\.css/);
  assert.match(html, /\/vendor\/leaflet\/leaflet\.js/);
  assert.doesNotMatch(html, /unpkg\.com/);
});

test('content security policy does not allow third-party script or style CDN origins', async () => {
  const response = await request(createServer()).get('/login').expect(200);
  const csp = response.headers['content-security-policy'] ?? '';
  assert.doesNotMatch(csp, /unpkg\.com/);
  assert.match(csp, /script-src 'self'/);
});
