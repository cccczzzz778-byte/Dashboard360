import type { Institution, InstitutionMetric } from '../domain/institution.js';
import type { UserPrincipal } from '../auth/types.js';
import { canAccessInstitution, filterInstitutionsForPrincipal } from '../auth/authorization.js';
import type { StoredRisk } from '../risk/repository.js';
import type { StoredAlert } from '../alerts/repository.js';
import type { IntegrationHealth } from '../integrations/repository.js';
import { buildInstitutionModules } from '../domain/modules.js';
import { mergeNamespacedMetrics } from '../domain/metric-namespace.js';
import { resolveMapStyle, type MapStyleResolution } from './map-config.js';
import type {
  SituationAlertSummary,
  SituationBootstrap,
  SituationDistrict,
  SituationInstitution,
  SituationMapInstitution,
  SituationSummary,
  TrendPoint,
  TrendQuery,
  TrendSeries
} from './types.js';

export class SituationCenterError extends Error {
  constructor(public readonly code: 'forbidden' | 'not_found') {
    super(code);
  }
}

export type SituationCenterDeps = {
  institutions: {
    listAll(): Promise<Institution[]>;
    findById(id: string): Promise<Institution | null>;
  };
  metrics: {
    listLatest(institutionId: string): Promise<InstitutionMetric[]>;
    listTrend?(input: TrendQuery & { institutionIds: string[] }): Promise<TrendPoint[]>;
  };
  risks: {
    listLatest(): Promise<StoredRisk[]>;
    latest(institutionId: string): Promise<StoredRisk | null>;
  };
  alerts: { listActive(): Promise<StoredAlert[]> };
  integrations: { listHealth(now?: Date): Promise<IntegrationHealth[]> };
  mapStyle?: MapStyleResolution;
};

const provinceWideRoles = new Set(['super_admin', 'executive', 'regional_specialist']);

function numericMetric(metrics: InstitutionMetric[], key: string): number | null {
  const raw = metrics.find(item => item.metricKey === key)?.metricValue;
  if (raw == null || raw === '') return null;
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(/\s+/g, ''));
  return Number.isFinite(value) ? value : null;
}

function sumPresent(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null && Number.isFinite(value));
  return present.length ? present.reduce((sum, value) => sum + value, 0) : null;
}

function completeness(institution: Institution, metrics: InstitutionMetric[]): number | null {
  const modules = mergeNamespacedMetrics(buildInstitutionModules(institution), metrics);
  const all = modules.flatMap(module => module.metrics);
  if (!all.length) return null;
  const available = all.filter(metric => metric.value !== null && metric.value !== '').length;
  return Math.round((available / all.length) * 100);
}

function unavailableRisk() {
  return { score: null, severity: 'unavailable' as const, coveragePct: 0 };
}

function mapInstitution(institution: Institution, risk: StoredRisk | undefined | null, metrics: InstitutionMetric[]): SituationMapInstitution {
  return {
    id: institution.id,
    officialName: institution.officialName,
    type: institution.type,
    districtKey: institution.districtKey,
    latitude: institution.latitude,
    longitude: institution.longitude,
    locationAccuracy: institution.locationAccuracy ?? 'unknown',
    risk: risk ? { score: risk.score, severity: risk.severity, coveragePct: risk.coveragePct } : unavailableRisk(),
    dataCompleteness: completeness(institution, metrics)
  };
}

function configuredMapStyle(deps: SituationCenterDeps): MapStyleResolution {
  if (deps.mapStyle) return deps.mapStyle;
  return resolveMapStyle({
    url: process.env.SITUATION_MAP_STYLE_URL,
    allowedHosts: String(process.env.SITUATION_MAP_STYLE_ALLOWED_HOSTS ?? '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  });
}

export function createSituationCenterService(deps: SituationCenterDeps) {
  const mapStyle = configuredMapStyle(deps);

  async function buildScoped(principal: UserPrincipal, districtKey?: string): Promise<SituationBootstrap> {
    const allInstitutions = await deps.institutions.listAll();
    const scoped = filterInstitutionsForPrincipal(principal, allInstitutions)
      .filter(institution => !districtKey || institution.districtKey === districtKey);
    const visibleIds = new Set(scoped.map(institution => institution.id));

    const [risks, alerts, integrations, metricRows] = await Promise.all([
      deps.risks.listLatest(),
      deps.alerts.listActive(),
      deps.integrations.listHealth(),
      Promise.all(scoped.map(async institution => [institution.id, await deps.metrics.listLatest(institution.id)] as const))
    ]);

    const riskById = new Map(risks.map(risk => [risk.institutionId, risk]));
    const metricsById = new Map(metricRows);
    const institutions = scoped.map(institution => mapInstitution(
      institution,
      riskById.get(institution.id),
      metricsById.get(institution.id) ?? []
    ));

    const visibleAlerts = alerts.filter(alert => {
      if (alert.institutionId) return visibleIds.has(alert.institutionId);
      return provinceWideRoles.has(principal.role);
    });

    const alertSummary: SituationAlertSummary = {
      critical: visibleAlerts.filter(alert => alert.severity === 'critical').length,
      warning: visibleAlerts.filter(alert => alert.severity === 'warning').length,
      items: visibleAlerts.slice(0, 20)
    };

    const summary: SituationSummary = {
      institutions: scoped.length,
      doctors: sumPresent(scoped.map(institution => numericMetric(metricsById.get(institution.id) ?? [], 'staff.doctors')),
      nurses: sumPresent(scoped.map(institution => numericMetric(metricsById.get(institution.id) ?? [], 'staff.nurses')),
      beds: sumPresent(scoped.map(institution => numericMetric(metricsById.get(institution.id) ?? [], 'inpatient.beds')),
      dataCompleteness: institutions.some(item => item.dataCompleteness != null)
        ? Math.round(institutions.reduce((sum, item) => sum + (item.dataCompleteness ?? 0), 0) /
          institutions.filter(item => item.dataCompleteness != null).length)
        : null
    };

    const rankings = institutions
      .filter(item => item.risk.score != null)
      .map(item => ({ institutionId: item.id, name: item.officialName, value: item.risk.score as number, sourceState: item.risk.severity }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const districtCounts = new Map<string, number>();
    for (const institution of scoped) districtCounts.set(institution.districtKey, (districtCounts.get(institution.districtKey) ?? 0) + 1);

    return {
      generatedAt: new Date().toISOString(),
      institutions,
      districts: Array.from(districtCounts.entries()).map(([key, count]) => ({ key, institutions: count })),
      summary,
      rankings,
      alerts: alertSummary,
      integrations,
      mapStyle
    };
  }

  return {
    buildBootstrap(principal: UserPrincipal) {
      return buildScoped(principal);
    },

    async buildDistrict(principal: UserPrincipal, districtKey: string): Promise<SituationDistrict> {
      return { ...(await buildScoped(principal, districtKey)), districtKey };
    },

    async buildInstitution(principal: UserPrincipal, institutionId: string): Promise<SituationInstitution> {
      const institution = await deps.institutions.findById(institutionId);
      if (!institution) throw new SituationCenterError('not_found');
      if (!canAccessInstitution(principal, institution)) throw new SituationCenterError('forbidden');
      const [risk, metrics] = await Promise.all([
        deps.risks.latest(institution.id),
        deps.metrics.listLatest(institution.id)
      ]);
      return { institution: mapInstitution(institution, risk, metrics), metrics };
    },

    async buildTrend(principal: UserPrincipal, query: TrendQuery): Promise<TrendSeries> {
      const visible = filterInstitutionsForPrincipal(principal, await deps.institutions.listAll());
      let selected = visible;
      if (query.institutionId) {
        const institution = await deps.institutions.findById(query.institutionId);
        if (!institution) throw new SituationCenterError('not_found');
        if (!canAccessInstitution(principal, institution)) throw new SituationCenterError('forbidden');
        selected = [institution];
      } else if (query.districtKey) {
        selected = visible.filter(institution => institution.districtKey === query.districtKey);
      }
      const items = deps.metrics.listTrend
        ? await deps.metrics.listTrend({ ...query, institutionIds: selected.map(institution => institution.id) })
        : [];
      return { metricKey: query.metricKey, items: items.filter(item => item.value == null || Number.isFinite(item.value)) };
    }
  };
}
