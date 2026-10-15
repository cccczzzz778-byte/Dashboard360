export type Institution = {
  id: string;
  officialName: string;
  type: string;
  districtKey: string;
  address: string | null;
  leaderName: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy?: 'exact' | 'district-center' | 'city-center' | 'unknown';
};

export type MetricSourceType = 'live' | 'manual' | 'imported' | 'unavailable';

export type InstitutionMetric = {
  metricKey: string;
  metricValue: number | string | null;
  unit: string | null;
  sourceType: MetricSourceType;
  sourceName: string | null;
  fetchedAt: string | null;
};

export type MetricSource = {
  sourceKey: string;
  sourceType: MetricSourceType;
  status: 'ok' | 'unavailable' | 'error' | 'auth_required';
  lastSuccessAt: string | null;
};
