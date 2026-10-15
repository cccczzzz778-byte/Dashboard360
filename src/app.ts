import express from 'express';
import path from 'node:path';
import { Pool } from 'pg';
import { createInstitutionRepository, ensureSchema, listLatestMetrics, upsertManualMetric } from './db/index.js';
import { normalizeDistrictName } from './map/district-map.js';
import { dashboardHtml } from './views/dashboard.js';
import { loginHtml } from './views/login.js';
import { SessionManager, hashPassword, verifyPassword } from './auth/session.js';
import { requireAuth } from './auth/middleware.js';
import { buildInstitutionModules, metricExists, moduleDefinitions } from './domain/modules.js';
import { mergeNamespacedMetrics, namespacedMetricKey } from './domain/metric-namespace.js';
import { audit } from './audit/log.js';
import { catalogByDistrict, catalogInstitution, districts, institutionCatalog, integrations } from './catalog.js';
import type { Institution, InstitutionMetric } from './domain/institution.js';

export function resolvePublicDir(root = process.cwd()) {
  return path.join(root, 'public');
}

export function createServer(options: { pool?: Pool; sessionManager?: SessionManager } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com; script-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
    next();
  });
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(express.json({ limit: '64kb' }));
  app.use(express.static(resolvePublicDir(), { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

  const sessions = options.sessionManager ?? new SessionManager();
  const pool = options.pool ?? (process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : undefined);
  const repo = pool ? createInstitutionRepository(pool) : undefined;
  const dbReady = pool ? ensureSchema(pool, institutionCatalog).catch(error => {
    console.error(JSON.stringify({ type: 'database_bootstrap_error', message: error?.message ?? String(error) }));
  }) : Promise.resolve();

  const sourceStates = () => [
    { key: 'database', label: 'PostgreSQL', status: pool ? 'configured' : 'unavailable' },
    { key: 'kpi', label: 'KPI platforma', status: process.env.KPI_API_URL ? 'configured' : 'unavailable' },
    { key: 'appeals', label: 'Murojaatlar', status: process.env.APPEALS_API_URL ? 'configured' : 'unavailable' },
    { key: 'qr', label: 'QR baholash', status: process.env.QR_API_URL ? 'configured' : 'unavailable' },
    { key: 'dmed', label: 'DMED BI', status: 'browser-auth' },
    { key: 'ona-bola', label: 'Ona-bola registri', status: 'external' }
  ];

  async function allInstitutions(): Promise<Institution[]> {
    await dbReady;
    if (!repo) return institutionCatalog;
    try {
      const rows = await repo.listAll();
      return rows.length ? rows : institutionCatalog;
    } catch { return institutionCatalog; }
  }

  async function byDistrict(districtKey: string): Promise<Institution[]> {
    await dbReady;
    if (!repo) return catalogByDistrict(districtKey);
    try {
      const rows = await repo.listByDistrict(districtKey);
      return rows.length ? rows : catalogByDistrict(districtKey);
    } catch { return catalogByDistrict(districtKey); }
  }

  async function findInstitution(id: string): Promise<Institution | null> {
    await dbReady;
    if (repo) {
      try { const row = await repo.findById(id); if (row) return row; } catch { /* fallback */ }
    }
    return catalogInstitution(id);
  }

  function modulesFor(institution: Institution, metrics: InstitutionMetric[]) {
    return mergeNamespacedMetrics(buildInstitutionModules(institution), metrics);
  }

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
    res.setHeader('Set-Cookie', `ssb360=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    res.redirect('/');
  });
  app.get('/logout', (req, res) => {
    const token = /(?:^|;\s*)ssb360=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    if (token) sessions.destroy(token);
    res.setHeader('Set-Cookie', 'ssb360=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    res.redirect('/login');
  });

  app.get('/', requireAuth(sessions), (_req, res) => res.send(dashboardHtml()));

  app.get('/api/bootstrap', requireAuth(sessions), async (_req, res) => {
    const institutions = await allInstitutions();
    const sources = sourceStates();
    res.json({
      generatedAt: new Date().toISOString(),
      districts,
      institutions,
      modules: moduleDefinitions,
      integrations,
      sources,
      summary: {
        institutions: institutions.length,
        districts: districts.length,
        configuredSources: sources.filter(x => x.status !== 'unavailable').length,
        totalSources: sources.length
      },
      notices: [
        'Muassasa koordinatalari aniq GPS tasdiqlanmaguncha hudud yoki shahar markazi bo‘yicha ko‘rsatiladi.',
        'Ulanmagan ko‘rsatkichlar 0 emas, N/A sifatida ko‘rsatiladi.'
      ]
    });
  });

  app.get('/api/institutions', requireAuth(sessions), async (req, res) => {
    const raw = String(req.query.district ?? '');
    if (!raw) return res.json(await allInstitutions());
    const district = normalizeDistrictName(raw);
    res.json(await byDistrict(district));
  });

  app.get('/api/institutions/:id/summary', requireAuth(sessions), async (req, res) => {
    const institution = await findInstitution(String(req.params.id));
    if (!institution) return res.status(404).json({ code: 'not_found' });
    let metrics: InstitutionMetric[] = [];
    if (pool) {
      try { await dbReady; metrics = await listLatestMetrics(pool, institution.id); } catch { metrics = []; }
    }
    res.json({ institution, modules: modulesFor(institution, metrics), integrations });
  });

  app.get('/api/modules/:institutionId', requireAuth(sessions), async (req, res) => {
    const institution = await findInstitution(String(req.params.institutionId));
    if (!institution) return res.status(404).json({ code: 'not_found' });
    let metrics: InstitutionMetric[] = [];
    if (pool) {
      try { metrics = await listLatestMetrics(pool, institution.id); } catch { metrics = []; }
    }
    res.json({ institutionId: institution.id, modules: modulesFor(institution, metrics) });
  });

  app.post('/api/admin/metrics', requireAuth(sessions), async (req, res) => {
    if (!pool) return res.status(503).json({ code: 'database_unavailable' });
    const institutionId = String(req.body.institutionId ?? '').slice(0, 120);
    const moduleKey = String(req.body.moduleKey ?? '').slice(0, 80);
    const metricKey = String(req.body.metricKey ?? '').slice(0, 120);
    const rawValue = req.body.value;
    const unit = req.body.unit == null ? null : String(req.body.unit).slice(0, 50);
    const moduleExists = moduleDefinitions.some(x => x.key === moduleKey);
    if (!institutionId || !moduleExists || !metricKey || !metricExists(metricKey)) return res.status(400).json({ code: 'invalid_metric' });
    if (!(await findInstitution(institutionId))) return res.status(404).json({ code: 'institution_not_found' });
    const value = rawValue == null || rawValue === '' ? null : String(rawValue).slice(0, 200);
    try {
      const saved = await upsertManualMetric(pool, { institutionId, metricKey: namespacedMetricKey(moduleKey, metricKey), value, unit });
      audit('metric_upsert', { institutionId, moduleKey, metricKey });
      res.json({ ok: true, metric: saved });
    } catch (error: any) {
      console.error(JSON.stringify({ type: 'metric_upsert_error', message: error?.message ?? String(error) }));
      res.status(500).json({ code: 'save_failed' });
    }
  });

  app.get('/api/integrations', requireAuth(sessions), (_req, res) => res.json({ integrations, sources: sourceStates() }));

  return app;
}

export { hashPassword };
