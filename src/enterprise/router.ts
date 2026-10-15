import { Router } from 'express';
import type { Institution } from '../domain/institution.js';
import type { SessionBackend } from '../auth/middleware.js';
import { requireAuth } from '../auth/middleware.js';
import { canAccessInstitution, principalFromSession, requirePermission } from '../auth/authorization.js';
import type { StoredRisk } from '../risk/repository.js';
import type { StoredAlert } from '../alerts/repository.js';
import type { IntegrationHealth } from '../integrations/repository.js';
import type { UserPrincipal } from '../auth/types.js';

export type EnterpriseRouterDeps = {
  sessionBackend: SessionBackend;
  institutions: {
    listAll(): Promise<Institution[]>;
    findById(id: string): Promise<Institution | null>;
  };
  risk: {
    listLatest(): Promise<StoredRisk[]>;
    latest(institutionId: string): Promise<StoredRisk | null>;
  };
  alerts: {
    listActive(): Promise<StoredAlert[]>;
  };
  integrations: {
    listHealth(now?: Date): Promise<IntegrationHealth[]>;
  };
  executiveToday?: {
    build(principal: UserPrincipal): Promise<unknown>;
  };
};

const provinceWideRoles = new Set(['super_admin', 'executive', 'regional_specialist']);

function principal(req: any): UserPrincipal | null {
  return req.principal ?? principalFromSession(req.session);
}

export function createEnterpriseRouter(deps: EnterpriseRouterDeps) {
  const router = Router();
  const auth = requireAuth(deps.sessionBackend);

  router.get('/risk', auth, requirePermission('institution.view'), async (req, res) => {
    const actor = principal(req);
    if (!actor) return res.status(403).json({ code: 'forbidden' });
    const [risks, institutions] = await Promise.all([deps.risk.listLatest(), deps.institutions.listAll()]);
    const byId = new Map(institutions.map(item => [item.id, item]));
    const items = risks.filter(item => {
      const institution = byId.get(item.institutionId);
      return Boolean(institution && canAccessInstitution(actor, institution));
    });
    res.json({ items });
  });

  router.get('/risk/:institutionId', auth, requirePermission('institution.view'), async (req, res) => {
    const actor = principal(req);
    const institution = await deps.institutions.findById(String(req.params.institutionId));
    if (!institution) return res.status(404).json({ code: 'not_found' });
    if (!canAccessInstitution(actor, institution)) return res.status(403).json({ code: 'forbidden' });
    const risk = await deps.risk.latest(institution.id);
    res.json({
      institutionId: institution.id,
      risk: risk ?? {
        institutionId: institution.id,
        score: null,
        severity: 'unavailable',
        coveragePct: 0,
        calculatedAt: null,
        factors: []
      }
    });
  });

  router.get('/alerts', auth, requirePermission('alerts.view'), async (req, res) => {
    const actor = principal(req);
    if (!actor) return res.status(403).json({ code: 'forbidden' });
    const [alerts, institutions] = await Promise.all([deps.alerts.listActive(), deps.institutions.listAll()]);
    const byId = new Map(institutions.map(item => [item.id, item]));
    const provinceWide = provinceWideRoles.has(actor.role);
    const items = alerts.filter(alert => {
      if (!alert.institutionId) return provinceWide;
      const institution = byId.get(alert.institutionId);
      return Boolean(institution && canAccessInstitution(actor, institution));
    });
    res.json({ items });
  });

  router.get('/integrations/health', auth, requirePermission('integrations.view'), async (_req, res) => {
    res.json({ items: await deps.integrations.listHealth() });
  });

  router.get('/executive/today', auth, requirePermission('institution.view'), async (req, res) => {
    const actor = principal(req);
    if (!actor) return res.status(403).json({ code: 'forbidden' });
    if (!deps.executiveToday) return res.status(503).json({ code: 'not_ready' });
    res.json(await deps.executiveToday.build(actor));
  });

  return router;
}
