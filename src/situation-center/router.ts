import { Router, type Request, type Response } from 'express';
import type { SessionBackend } from '../auth/middleware.js';
import { requireAuth } from '../auth/middleware.js';
import { principalFromSession, requirePermission } from '../auth/authorization.js';
import type { UserPrincipal } from '../auth/types.js';
import { SituationCenterError } from './service.js';
import type { SituationBootstrap, SituationDistrict, SituationInstitution, TrendQuery, TrendSeries } from './types.js';

export type SituationCenterService = {
  buildBootstrap(principal: UserPrincipal): Promise<SituationBootstrap | unknown>;
  buildDistrict(principal: UserPrincipal, districtKey: string): Promise<SituationDistrict | unknown>;
  buildInstitution(principal: UserPrincipal, institutionId: string): Promise<SituationInstitution | unknown>;
  buildTrend(principal: UserPrincipal, query: TrendQuery): Promise<TrendSeries | unknown>;
};

export type SituationCenterRouterDeps = {
  sessionBackend: SessionBackend;
  service: SituationCenterService;
};

function principal(req: Request): UserPrincipal | null {
  return (req as any).principal ?? principalFromSession((req as any).session);
}

function bounded(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  return value;
}

function trendQuery(req: Request): TrendQuery | null {
  const metricKey = bounded(req.query.metricKey, 160);
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (!metricKey || !from || !to) return null;
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  if (fromMs > toMs || toMs - fromMs > 366 * 24 * 60 * 60 * 1000) return null;
  const institutionId = bounded(req.query.institutionId, 120);
  const districtKey = bounded(req.query.districtKey, 120);
  if (institutionId && districtKey) return null;
  return {
    metricKey,
    from,
    to,
    ...(institutionId ? { institutionId } : {}),
    ...(districtKey ? { districtKey } : {})
  };
}

function sendDomainError(error: unknown, res: Response): boolean {
  if (!(error instanceof SituationCenterError)) return false;
  if (error.code === 'forbidden') res.status(403).json({ code: 'forbidden' });
  else res.status(404).json({ code: 'not_found' });
  return true;
}

export function createSituationCenterRouter(deps: SituationCenterRouterDeps) {
  const router = Router();
  const auth = requireAuth(deps.sessionBackend);
  const view = requirePermission('institution.view');

  router.get('/bootstrap', auth, view, async (req, res) => {
    const actor = principal(req);
    if (!actor) return res.status(403).json({ code: 'forbidden' });
    res.json(await deps.service.buildBootstrap(actor));
  });

  router.get('/districts/:districtKey', auth, view, async (req, res) => {
    const actor = principal(req);
    if (!actor) return res.status(403).json({ code: 'forbidden' });
    const districtKey = bounded(req.params.districtKey, 120);
    if (!districtKey) return res.status(400).json({ code: 'invalid_district' });
    try {
      res.json(await deps.service.buildDistrict(actor, districtKey));
    } catch (error) {
      if (!sendDomainError(error, res)) throw error;
    }
  });

  router.get('/institutions/:institutionId', auth, view, async (req, res) => {
    const actor = principal(req);
    if (!actor) return res.status(403).json({ code: 'forbidden' });
    const institutionId = bounded(req.params.institutionId, 120);
    if (!institutionId) return res.status(400).json({ code: 'invalid_institution' });
    try {
      res.json(await deps.service.buildInstitution(actor, institutionId));
    } catch (error) {
      if (!sendDomainError(error, res)) throw error;
    }
  });

  router.get('/trends', auth, view, async (req, res) => {
    const actor = principal(req);
    if (!actor) return res.status(403).json({ code: 'forbidden' });
    const query = trendQuery(req);
    if (!query) return res.status(400).json({ code: 'invalid_trend_query' });
    try {
      res.json(await deps.service.buildTrend(actor, query));
    } catch (error) {
      if (!sendDomainError(error, res)) throw error;
    }
  });

  return router;
}
