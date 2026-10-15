import express from 'express';
import path from 'node:path';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { createInstitutionRepository, ensureSchema, listLatestMetrics, listMetricTrend, upsertManualMetric } from './db/index.js';
import { normalizeDistrictName } from './map/district-map.js';
import { dashboardHtml } from './views/dashboard.js';
import { loginHtml } from './views/login.js';
import { situationCenterHtml } from './views/situation-center.js';
import { SessionManager, hashPassword, verifyPassword } from './auth/session.js';
import { SessionStore } from './auth/session-store.js';
import { requireAuth, requireCsrf, readSessionToken, sessionCookieName } from './auth/middleware.js';
import { canAccessInstitution, filterInstitutionsForPrincipal, principalFromSession, requirePermission } from './auth/authorization.js';
import { createUserRepository } from './users/repository.js';
import { buildInstitutionModules, metricExists, moduleDefinitions } from './domain/modules.js';
import { mergeNamespacedMetrics, namespacedMetricKey } from './domain/metric-namespace.js';
import { createAuditRecorder } from './audit/store.js';
import { catalogByDistrict, catalogInstitution, districts, institutionCatalog, integrations } from './catalog.js';
import type { Institution, InstitutionMetric } from './domain/institution.js';
import type { UserPrincipal } from './auth/types.js';
import { securityHeaders, sameOriginGuard, requestFingerprint } from './security/http.js';
import { LoginRateLimiter, type LoginLimiter } from './security/rate-limit.js';
import { RedisLoginRateLimiter } from './security/redis-rate-limit.js';
import { checkReadiness } from './health/readiness.js';
import { createRiskRepository } from './risk/repository.js';
import { createAlertRepository } from './alerts/repository.js';
import { createIntegrationRepository } from './integrations/repository.js';
import { createEnterpriseRouter } from './enterprise/router.js';
import { createSituationCenterService } from './situation-center/service.js';
import { createSituationCenterRouter } from './situation-center/router.js';

export function resolvePublicDir(root = process.cwd()) {
  return path.join(root, 'public');
}

export function resolveLeafletDir(root = process.cwd()) {
  return path.join(root, 'node_modules', 'leaflet', 'dist');
}

export function resolveMapLibreDir(root = process.cwd()) {
  return path.join(root, 'node_modules', 'maplibre-gl', 'dist');
}

export function createServer(options: {
  pool?: Pool;
  sessionManager?: SessionManager;
  loginLimiter?: LoginLimiter;
  redisClient?: ReturnType<typeof createClient>;
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(sameOriginGuard);
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(express.json({ limit: '64kb' }));
  app.use('/vendor/leaflet', express.static(resolveLeafletDir(), {
    maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
    immutable: process.env.NODE_ENV === 'production',
    fallthrough: false
  }));
  app.use('/vendor/maplibre', express.static(resolveMapLibreDir(), {
    maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
    immutable: process.env.NODE_ENV === 'production',
    fallthrough: false
  }));
  app.use(express.static(resolvePublicDir(), { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

  const pool = options.pool ?? (process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : undefined);
  const memorySessions = options.sessionManager ?? new SessionManager();
  const persistentSessions = pool && process.env.NODE_ENV === 'production' && !options.sessionManager
    ? new SessionStore(pool)
    : undefined;
  const sessions = persistentSessions ?? memorySessions;
  const userRepo = pool ? createUserRepository(pool) : undefined;
  const auditRecorder = createAuditRecorder(pool ? { query: (sql, values) => pool.query(sql, values as any[]) } : undefined);

  const redisClient = options.redisClient ?? (process.env.REDIS_URL ? createClient({ url: process.env.REDIS_URL }) : undefined);
  if (redisClient && !options.redisClient) {
    redisClient.on('error', (error: any) => {
      console.error(JSON.stringify({ type: 'redis_error', code: error?.code ?? 'redis_error' }));
    });
    void redisClient.connect().catch((error: any) => {
      console.error(JSON.stringify({ type: 'redis_connect_error', code: error?.code ?? 'redis_error' }));
    });
  }
  app.locals.redisClient = redisClient;
  app.locals.pool = pool;
  app.locals.auditRecorder = auditRecorder;
  app.locals.sessionBackend = sessions;

  const loginLimiter: LoginLimiter = options.loginLimiter ?? (
    redisClient
      ? new RedisLoginRateLimiter({ sendCommand: args => redisClient.sendCommand(args) })
      : new LoginRateLimiter()
  );

  const repo = pool ? createInstitutionRepository(pool) : undefined;
  const dbReady = pool ? ensureSchema(pool, institutionCatalog).catch(error => {
    console.error(JSON.stringify({ type: 'database_bootstrap_error', code: error?.code ?? 'database_error' }));
  }) : Promise.resolve();

  const sourceStates = () => [
    { key: 'database', label: 'PostgreSQL', status: pool ? 'configured' : 'unavailable' },
    { key: 'redis', label: 'Redis xavfsizlik qatlami', status: redisClient ? 'configured' : 'unavailable' },
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

  function requestPrincipal(req: express.Request) {
    return (req as any).principal ?? principalFromSession((req as any).session);
  }

  const riskRepo = pool ? createRiskRepository(pool) : {
    async listLatest() { return []; },
    async latest(_institutionId: string) { return null; }
  };
  const alertRepo = pool ? createAlertRepository(pool) : {
    async listActive() { return []; }
  };
  const integrationRepo = pool ? createIntegrationRepository(pool) : {
    async listHealth() { return []; }
  };

  const situationCenterService = createSituationCenterService({
    institutions: { listAll: allInstitutions, findById: findInstitution },
    metrics: {
      async listLatest(institutionId: string) {
        if (!pool) return [];
        try {
          await dbReady;
          return await listLatestMetrics(pool, institutionId);
        } catch {
          return [];
        }
      },
      async listTrend(input) {
        if (!pool) return [];
        try {
          await dbReady;
          return await listMetricTrend(pool, input);
        } catch {
          return [];
        }
      }
    },
    risks: riskRepo,
    alerts: alertRepo,
    integrations: integrationRepo
  });

  app.use('/api/v1', createEnterpriseRouter({
    sessionBackend: sessions,
    institutions: { listAll: allInstitutions, findById: findInstitution },
    risk: riskRepo,
    alerts: alertRepo,
    integrations: integrationRepo
  }));
  app.use('/api/v1/situation-center', createSituationCenterRouter({
    sessionBackend: sessions,
    service: situationCenterService
  }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'buxoro-ssb-360' }));

  app.get('/api/ready', async (_req, res) => {
    const state = await checkReadiness({
      database: async () => {
        if (!pool) return false;
        await pool.query('select 1');
        return true;
      },
      redis: redisClient ? async () => {
        if (!redisClient.isReady) return false;
        return (await redisClient.ping()) === 'PONG';
      } : undefined
    }, 1000);
    res.status(state.ok ? 200 : 503).json({
      ok: state.ok,
      dependencies: { database: state.database, redis: state.redis }
    });
  });

  app.get('/login', (_req, res) => res.send(loginHtml()));
  app.post('/login', async (req, res) => {
    const configuredUser = process.env.ADMIN_USERNAME ?? 'admin';
    const configuredHash = process.env.ADMIN_PASSWORD_HASH;
    const legacyPassword = process.env.ADMIN_PASSWORD;
    const username = String(req.body.username ?? '').slice(0, 120);
    const password = String(req.body.password ?? '').slice(0, 500);
    const ipKey = req.ip || req.socket.remoteAddress || 'unknown';
    const client = requestFingerprint(req);
    const rate = await loginLimiter.check(ipKey, username);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      void auditRecorder.record('login_throttled', { username: username || 'empty', client });
      return res.status(429).send(loginHtml('Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.'));
    }

    let valid = false;
    let principal: UserPrincipal | null = null;

    if (persistentSessions && userRepo) {
      await dbReady;
      if (configuredHash && username === configuredUser) {
        try {
          await userRepo.ensureBootstrapAdmin({ username: configuredUser, passwordHash: configuredHash });
        } catch (error: any) {
          console.error(JSON.stringify({ type: 'bootstrap_admin_error', code: error?.code ?? 'bootstrap_admin_error' }));
        }
      }
      const account = await userRepo.findByUsername(username);
      if (account) {
        valid = await verifyPassword(password, account.passwordHash);
        if (valid) {
          const { passwordHash: _passwordHash, isActive: _isActive, ...safePrincipal } = account;
          principal = safePrincipal;
        }
      }
    } else {
      valid = username === configuredUser;
      if (valid && configuredHash) valid = await verifyPassword(password, configuredHash);
      else if (valid && process.env.NODE_ENV !== 'production' && legacyPassword) valid = password === legacyPassword;
      else valid = false;
    }

    if (!valid) {
      await loginLimiter.fail(ipKey, username);
      void auditRecorder.record('login_failed', { username: username || 'empty', client });
      return res.status(401).send(loginHtml('Login yoki parol xato'));
    }

    await loginLimiter.success(ipKey, username);
    let token: string;
    if (persistentSessions && principal) {
      const created = await persistentSessions.create(principal, { clientFingerprint: client });
      token = created.token;
    } else {
      token = memorySessions.create({ username: configuredUser, role: 'admin' });
    }

    void auditRecorder.record('login', { username, client });
    const cookieName = sessionCookieName();
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800; Priority=High${secure}`);
    res.redirect('/');
  });

  app.get('/logout', async (req, res) => {
    const token = readSessionToken(req.headers.cookie ?? '');
    const session = await sessions.get(token) as any;
    if (token) {
      if (persistentSessions) await persistentSessions.revoke(token);
      else memorySessions.destroy(token);
    }
    void auditRecorder.record('logout', { username: session?.username ?? 'unknown', client: requestFingerprint(req) });
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.append('Set-Cookie', `${sessionCookieName()}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
    res.append('Set-Cookie', `ssb360=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
    res.redirect('/login');
  });

  app.get('/', requireAuth(sessions), (_req, res) => res.send(dashboardHtml()));
  app.get('/situation-center', requireAuth(sessions), requirePermission('institution.view'), (_req, res) => res.send(situationCenterHtml()));

  app.get('/api/bootstrap', requireAuth(sessions), requirePermission('institution.view'), async (req, res) => {
    const principal = requestPrincipal(req);
    const institutions = filterInstitutionsForPrincipal(principal, await allInstitutions());
    const sources = sourceStates();
    const session = (req as any).session;
    res.json({
      generatedAt: new Date().toISOString(),
      districts,
      institutions,
      modules: moduleDefinitions,
      integrations,
      sources,
      security: { csrfToken: session.csrfToken, role: session.role },
      summary: {
        institutions: institutions.length,
        districts: new Set(institutions.map(x => x.districtKey)).size,
        configuredSources: sources.filter(x => x.status !== 'unavailable').length,
        totalSources: sources.length
      },
      notices: [
        'Muassasa koordinatalari aniq GPS tasdiqlanmaguncha hudud yoki shahar markazi bo‘yicha ko‘rsatiladi.',
        'Ulanmagan ko‘rsatkichlar 0 emas, N/A sifatida ko‘rsatiladi.'
      ]
    });
  });

  app.get('/api/institutions', requireAuth(sessions), requirePermission('institution.view'), async (req, res) => {
    const principal = requestPrincipal(req);
    const raw = String(req.query.district ?? '');
    const rows = raw ? await byDistrict(normalizeDistrictName(raw)) : await allInstitutions();
    res.json(filterInstitutionsForPrincipal(principal, rows));
  });

  app.get('/api/institutions/:id/summary', requireAuth(sessions), requirePermission('institution.view'), async (req, res) => {
    const institution = await findInstitution(String(req.params.id));
    if (!institution) return res.status(404).json({ code: 'not_found' });
    if (!canAccessInstitution(requestPrincipal(req), institution)) return res.status(403).json({ code: 'forbidden' });
    let metrics: InstitutionMetric[] = [];
    if (pool) {
      try { await dbReady; metrics = await listLatestMetrics(pool, institution.id); } catch { metrics = []; }
    }
    res.json({ institution, modules: modulesFor(institution, metrics), integrations });
  });

  app.get('/api/modules/:institutionId', requireAuth(sessions), requirePermission('institution.view'), async (req, res) => {
    const institution = await findInstitution(String(req.params.institutionId));
    if (!institution) return res.status(404).json({ code: 'not_found' });
    if (!canAccessInstitution(requestPrincipal(req), institution)) return res.status(403).json({ code: 'forbidden' });
    let metrics: InstitutionMetric[] = [];
    if (pool) {
      try { metrics = await listLatestMetrics(pool, institution.id); } catch { metrics = []; }
    }
    res.json({ institutionId: institution.id, modules: modulesFor(institution, metrics) });
  });

  app.post('/api/admin/metrics', requireAuth(sessions), requirePermission('metric.write'), requireCsrf(sessions), async (req, res) => {
    if (!pool) return res.status(503).json({ code: 'database_unavailable' });
    const institutionId = String(req.body.institutionId ?? '').slice(0, 120);
    const moduleKey = String(req.body.moduleKey ?? '').slice(0, 80);
    const metricKey = String(req.body.metricKey ?? '').slice(0, 120);
    const rawValue = req.body.value;
    const unit = req.body.unit == null ? null : String(req.body.unit).slice(0, 50);
    const moduleExists = moduleDefinitions.some(x => x.key === moduleKey);
    if (!institutionId || !moduleExists || !metricKey || !metricExists(metricKey)) return res.status(400).json({ code: 'invalid_metric' });
    const institution = await findInstitution(institutionId);
    if (!institution) return res.status(404).json({ code: 'institution_not_found' });
    if (!canAccessInstitution(requestPrincipal(req), institution)) return res.status(403).json({ code: 'forbidden' });
    const value = rawValue == null || rawValue === '' ? null : String(rawValue).slice(0, 200);
    try {
      const saved = await upsertManualMetric(pool, { institutionId, metricKey: namespacedMetricKey(moduleKey, metricKey), value, unit });
      void auditRecorder.record('metric_upsert', {
        institutionId,
        moduleKey,
        metricKey,
        username: (req as any).session?.username,
        client: requestFingerprint(req)
      });
      res.json({ ok: true, metric: saved });
    } catch (error: any) {
      console.error(JSON.stringify({ type: 'metric_upsert_error', code: error?.code ?? 'save_failed' }));
      res.status(500).json({ code: 'save_failed' });
    }
  });

  app.get('/api/integrations', requireAuth(sessions), requirePermission('integrations.view'), (_req, res) => res.json({ integrations, sources: sourceStates() }));

  return app;
}

export { hashPassword };