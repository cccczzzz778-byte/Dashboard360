import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from '../../src/app.js';
import { SessionManager } from '../../src/auth/session.js';

const viewUrl = new URL('../../src/views/situation-center.ts', import.meta.url);
const styleUrl = new URL('../../public/css/situation-center.css', import.meta.url);

function cookieFrom(res: any) {
  const raw = res.headers['set-cookie'];
  return (Array.isArray(raw) ? raw[0] : raw).split(';')[0];
}

async function authenticatedApp() {
  const oldU = process.env.ADMIN_USERNAME;
  const oldP = process.env.ADMIN_PASSWORD;
  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'secret';
  const app = createServer({ sessionManager: new SessionManager() });
  const login = await request(app).post('/login').type('form').send({ username:'admin', password:'secret' }).expect(302);
  const cookie = cookieFrom(login);
  return {
    app, cookie,
    restore() {
      if (oldU === undefined) delete process.env.ADMIN_USERNAME; else process.env.ADMIN_USERNAME = oldU;
      if (oldP === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = oldP;
      if (oldEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnv;
    }
  };
}

test('situation center page is authenticated and uses only self-hosted assets', async () => {
  assert.ok(existsSync(viewUrl), 'src/views/situation-center.ts must exist');
  const app = createServer({ sessionManager: new SessionManager() });
  await request(app).get('/situation-center').expect(302).expect('Location','/login');

  const ctx = await authenticatedApp();
  try {
    const page = await request(ctx.app).get('/situation-center').set('Cookie',ctx.cookie).expect(200);
    assert.match(page.text, /id="situationMap"/);
    assert.match(page.text, /id="situationSummary"/);
    assert.match(page.text, /id="situationAlerts"/);
    assert.match(page.text, /\/vendor\/maplibre\/maplibre-gl\.css/);
    assert.match(page.text, /type="module"[^>]+\/js\/situation-center\.js/);
    assert.doesNotMatch(page.text, /unpkg|jsdelivr|cdnjs/i);
  } finally { ctx.restore(); }
});

test('dashboard exposes 3D entry and createServer mounts situation center API', async () => {
  const ctx = await authenticatedApp();
  try {
    const dashboard = await request(ctx.app).get('/').set('Cookie',ctx.cookie).expect(200);
    assert.match(dashboard.text, /href="\/situation-center"/);
    assert.match(dashboard.text, /3D Situatsion markaz/);

    const api = await request(ctx.app).get('/api/v1/situation-center/bootstrap').set('Cookie',ctx.cookie).expect(200);
    assert.ok(Array.isArray(api.body.institutions));
    assert.ok(api.body.summary);
  } finally { ctx.restore(); }
});

test('situation center CSS reserves a dominant map and safe 16:9 TV panels', () => {
  assert.ok(existsSync(styleUrl), 'public/css/situation-center.css must exist');
  if (!existsSync(styleUrl)) return;
  const css = readFileSync(styleUrl, 'utf8');
  assert.match(css, /min-height\s*:\s*100(?:dvh|vh)/i);
  assert.match(css, /\.situation-layout[\s\S]*grid-template-columns\s*:/i);
  assert.match(css, /minmax\([^)]*1fr[^)]*\)|minmax\([^)]*,\s*2fr\)/i);
  assert.match(css, /@media[^\{]*min-width\s*:\s*1900px/i);
  assert.match(css, /\.situation-map-stage/i);
  assert.match(css, /\.situation-fallback/i);
  assert.match(css, /@media[^\{]*max-width/i);
});
