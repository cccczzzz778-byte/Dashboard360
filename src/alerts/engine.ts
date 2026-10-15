import type { RiskSeverity } from '../risk/types.js';
import type { IntegrationHealthStatus } from '../integrations/freshness.js';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertCandidate = {
  institutionId: string | null;
  sourceKey: string | null;
  alertType: string;
  severity: AlertSeverity;
  title: string;
  reason: string;
  dedupKey: string;
  metadata?: Record<string, unknown>;
};

export type AlertDerivationInput = {
  institutionId: string | null;
  risk: { score: number | null; severity: RiskSeverity; coveragePct: number } | null;
  integrations: Array<{ key: string; label: string; status: IntegrationHealthStatus }>;
};

const integrationSeverity: Partial<Record<IntegrationHealthStatus, AlertSeverity>> = {
  degraded: 'warning',
  stale: 'warning',
  offline: 'critical',
  auth_required: 'warning'
};

export function deriveAlerts(input: AlertDerivationInput): AlertCandidate[] {
  const alerts: AlertCandidate[] = [];

  if (input.institutionId && input.risk?.score != null && ['amber', 'red'].includes(input.risk.severity)) {
    const critical = input.risk.severity === 'red';
    alerts.push({
      institutionId: input.institutionId,
      sourceKey: null,
      alertType: 'risk',
      severity: critical ? 'critical' : 'warning',
      title: critical ? 'Muassasa yuqori xavf holatida' : 'Muassasa e’tibor talab qiladi',
      reason: `Risk ${input.risk.score}; qamrov ${input.risk.coveragePct}%`,
      dedupKey: `risk:${input.institutionId}`,
      metadata: { score: input.risk.score, severity: input.risk.severity, coveragePct: input.risk.coveragePct }
    });
  }

  for (const source of input.integrations) {
    const severity = integrationSeverity[source.status];
    if (!severity) continue;
    alerts.push({
      institutionId: null,
      sourceKey: source.key,
      alertType: 'integration',
      severity,
      title: `${source.label}: ${source.status}`,
      reason: `Ma’lumot manbasi holati: ${source.status}`,
      dedupKey: `integration:${source.key}:${source.status}`,
      metadata: { status: source.status }
    });
  }

  return alerts;
}
