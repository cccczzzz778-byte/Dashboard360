import type { Institution } from '../domain/institution.js';
import type { UserPrincipal } from '../auth/types.js';
import { canAccessInstitution } from '../auth/authorization.js';
import type { RiskSeverity } from '../risk/types.js';
import type { IntegrationHealthStatus } from '../integrations/freshness.js';

export type ExecutiveRisk = {
  institutionId: string;
  score: number | null;
  severity: RiskSeverity;
  coveragePct: number;
  calculatedAt?: string | null;
};

export type ExecutiveAlert = {
  id: number;
  institutionId: string | null;
  severity: 'info' | 'warning' | 'critical';
  status: string;
  [key: string]: unknown;
};

export type ExecutiveIntegration = {
  key: string;
  label: string;
  status: IntegrationHealthStatus;
  [key: string]: unknown;
};

export type ExecutiveTodayInput = {
  principal: UserPrincipal;
  institutions: Institution[];
  risks: ExecutiveRisk[];
  alerts: ExecutiveAlert[];
  integrations: ExecutiveIntegration[];
  generatedAt?: Date;
};

const provinceWideRoles = new Set(['super_admin', 'executive', 'regional_specialist']);
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const severityRank: Record<RiskSeverity, number> = { red: 3, amber: 2, green: 1, unavailable: 0 };

export function buildExecutiveToday(input: ExecutiveTodayInput) {
  const visibleInstitutions = input.institutions.filter(item => canAccessInstitution(input.principal, item));
  const visibleIds = new Set(visibleInstitutions.map(item => item.id));
  const riskByInstitution = new Map(
    input.risks.filter(risk => visibleIds.has(risk.institutionId)).map(risk => [risk.institutionId, risk])
  );
  const institutionById = new Map(visibleInstitutions.map(item => [item.id, item]));

  const topAttention = Array.from(riskByInstitution.values())
    .filter(risk => risk.score != null && (risk.severity === 'red' || risk.severity === 'amber'))
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || (b.score ?? -1) - (a.score ?? -1) || a.institutionId.localeCompare(b.institutionId))
    .slice(0, 10)
    .map(risk => {
      const institution = institutionById.get(risk.institutionId)!;
      return {
        institutionId: risk.institutionId,
        officialName: institution.officialName,
        districtKey: institution.districtKey,
        score: risk.score,
        severity: risk.severity,
        coveragePct: risk.coveragePct,
        calculatedAt: risk.calculatedAt ?? null
      };
    });

  const provinceWide = provinceWideRoles.has(input.principal.role);
  const criticalAlerts = input.alerts.filter(alert => {
    if (alert.severity !== 'critical') return false;
    if (alert.institutionId == null) return provinceWide;
    return visibleIds.has(alert.institutionId);
  });

  const attentionSources = provinceWide
    ? input.integrations.filter(source => source.status === 'stale' || source.status === 'offline')
    : [];

  const riskDistribution = { green: 0, amber: 0, red: 0, unavailable: 0 };
  let availableRiskCount = 0;
  let coverageTotal = 0;
  for (const institution of visibleInstitutions) {
    const risk = riskByInstitution.get(institution.id);
    if (!risk || risk.score == null || risk.severity === 'unavailable') {
      riskDistribution.unavailable += 1;
      continue;
    }
    riskDistribution[risk.severity] += 1;
    availableRiskCount += 1;
    coverageTotal += Number.isFinite(risk.coveragePct) ? risk.coveragePct : 0;
  }

  const total = visibleInstitutions.length;
  const riskCoveragePct = total ? round2((availableRiskCount / total) * 100) : 0;
  const averageMetricCoveragePct = availableRiskCount ? round2(coverageTotal / availableRiskCount) : 0;

  return {
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    summary: {
      institutions: total,
      attentionInstitutions: topAttention.length,
      criticalAlerts: criticalAlerts.length,
      attentionSources: attentionSources.length
    },
    topAttention,
    criticalAlerts,
    attentionSources,
    riskDistribution,
    dataCoverage: {
      riskAvailableInstitutions: availableRiskCount,
      totalInstitutions: total,
      riskCoveragePct,
      averageMetricCoveragePct
    }
  };
}

export function createExecutiveTodayService(deps: {
  institutions: { listAll(): Promise<Institution[]> };
  risk: { listLatest(): Promise<ExecutiveRisk[]> };
  alerts: { listActive(): Promise<ExecutiveAlert[]> };
  integrations: { listHealth(now?: Date): Promise<ExecutiveIntegration[]> };
  now?: () => Date;
}) {
  return {
    async build(principal: UserPrincipal) {
      const now = deps.now?.() ?? new Date();
      const [institutions, risks, alerts, integrations] = await Promise.all([
        deps.institutions.listAll(), deps.risk.listLatest(), deps.alerts.listActive(), deps.integrations.listHealth(now)
      ]);
      return buildExecutiveToday({ principal, institutions, risks, alerts, integrations, generatedAt: now });
    }
  };
}
