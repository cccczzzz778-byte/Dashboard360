import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createInstitutionRepository } from './db/index.js';
import { normalizeDistrictName } from './map/district-map.js';
import { dashboardHtml } from './views/dashboard.js';
import { loginHtml } from './views/login.js';
import { SessionManager, hashPassword, verifyPassword } from './auth/session.js';
import { requireAuth } from './auth/middleware.js';
import { buildUnavailableModules } from './domain/modules.js';
import { audit } from './audit/log.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer(options: { pool?: Pool; sessionManager?: SessionManager } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(express.static(path.join(dirname, '../public')));

  const sessions = options.sessionManager ?? new SessionManager();
  const pool = options.pool ?? (process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : undefined);
  const repo = pool ? createInstitutionRepository(pool) : undefined;

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'buxoro-ssb-360' }));

  app.get('/login', (_req, res) => res.send(loginHtml()));
  app.post('/login', async (req, res) => {
    const configuredUser = process.env.ADMIN_USERNAME ?? 'admin';
    const configuredHash = process.env.ADMIN_PASSWORD_HASH;
    const legacyPassword = process.env.ADMIN_PASSWORD;
    let valid = req.body.username === configuredUser;
    if (valid && configuredHash) valid = await verifyPassword(req.body.password ?? '', configuredHash);
    else if (valid && legacyPassword) valid = req.body.password === legacyPassword;
    else valid = false;
    if (!valid) return res.status(401).send(loginHtml('Login yoki parol xato'));
    const token = sessions.create({ username: configuredUser });
    audit('login', { username: configuredUser });
    res.setHeader('Set-Cookie', `ssb360=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`);
    res.redirect('/');
  });
  app.get('/logout', (req, res) => {
    const token = /(?:^|;\s*)ssb360=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    if (token) sessions.destroy(token);
    res.setHeader('Set-Cookie', 'ssb360=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    res.redirect('/login');
  });

  app.get('/', requireAuth(sessions), (_req, res) => res.send(dashboardHtml()));

  app.get('/api/institutions', requireAuth(sessions), async (req, res) => {
    const district = normalizeDistrictName(String(req.query.district ?? ''));
    if (!repo) return res.json([]);
    res.json(await repo.listByDistrict(district));
  });

  app.get('/api/institutions/:id/summary', requireAuth(sessions), async (req, res) => {
    if (!repo) return res.status(404).json({ code: 'not_found' });
    const institution = await repo.findById(req.params.id);
    if (!institution) return res.status(404).json({ code: 'not_found' });
    res.json({ institution, modules: buildUnavailableModules() });
  });

  app.get('/api/modules/:institutionId', requireAuth(sessions), async (req, res) => {
    if (!repo) return res.status(404).json({ code: 'not_found' });
    const institution = await repo.findById(req.params.institutionId);
    if (!institution) return res.status(404).json({ code: 'not_found' });
    res.json({ institutionId: institution.id, modules: buildUnavailableModules() });
  });

  return app;
}

export { hashPassword };
