import type { Institution, InstitutionMetric } from '../domain/institution.js';
import type { RiskSeverity } from '../risk/types.js';
import type { StoredAlert } from '../alerts/repository.js';
import type { IntegrationHealth } from '../integrations/repository.js';
import type { MapStyleResolution } from './map-config.js';

export type SituationRisk = {
  score: number | null;
  severity: RiskSeverity;
  coveragePct: number;
};

export type SituationMapInstitution = Pick<Institution,
  'id' | 'officialName' | 'type' | 'districtKey' | 'latitude' | 'longitude' | 'locationAccuracy'> & {
  risk: SituationRisk;
  dataCompleteness: number | null;
};

export type SituationSummary = {
  institutions: number;
  doctors: number | null;
  nurses: number | null;
  beds: number | null;
  dataCompleteness: number | null;
};

export type SituationRanking = {
  institutionId: string;
  name: string;
  value: number;
  sourceState: string;
};

export type SituationAlertSummary = {
  critical: number;
  warning: number;
  items: StoredAlert[];
};

export type SituationBootstrap = {
  generatedAt: string;
  institutions: SituationMapInstitution[];
  districts: Array<{ key: string; institutions: number }>;
  summary: SituationSummary;
  rankings: SituationRanking[];
  alerts: SituationAlertSummary;
  integrations: IntegrationHealth[];
  mapStyle: MapStyleResolution;
};

export type SituationDistrict = SituationBootstrap & { districtKey: string };

export type SituationInstitution = {
  institution: SituationMapInstitution;
  metrics: InstitutionMetric[];
};

export type TrendQuery = {
  metricKey: string;
  institutionId?: string;
  districtKey?: string;
  from: string;
  to: string;
};

export type TrendPoint = { period: string; value: number | null; sourceState?: string | null };
export type TrendSeries = { metricKey: string; items: TrendPoint[] };
