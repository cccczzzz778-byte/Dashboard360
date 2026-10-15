export type SourceStatus = 'live' | 'manual' | 'imported' | 'unavailable' | 'error';

export type ModuleMetric = {
  key: string;
  label: string;
  value: number | string | null;
  unit?: string | null;
  sourceStatus: SourceStatus;
  sourceName?: string | null;
  fetchedAt?: string | null;
};

export type InstitutionModulePayload = {
  key: ModuleKey;
  label: string;
  status: SourceStatus;
  metrics: ModuleMetric[];
};

export const moduleDefinitions = [
  { key: 'passport', label: 'Muassasa pasporti' },
  { key: 'staff', label: 'Kadrlar' },
  { key: 'patients', label: 'Bemorlar' },
  { key: 'admissions', label: 'Qabullar' },
  { key: 'diseases', label: 'Kasalliklar' },
  { key: 'inpatient', label: 'Statsionar' },
  { key: 'digital', label: 'DMED / Raqamlashtirish' },
  { key: 'equipment', label: 'AKT va qurilmalar' },
  { key: 'appeals', label: 'Murojaatlar / QR' },
  { key: 'kpi', label: 'KPI' }
] as const;

export type ModuleKey = typeof moduleDefinitions[number]['key'];

export function unavailableMetric(key: string, label: string, unit?: string): ModuleMetric {
  return { key, label, value: null, unit: unit ?? null, sourceStatus: 'unavailable', sourceName: null, fetchedAt: null };
}

export function buildUnavailableModules(): InstitutionModulePayload[] {
  const metricTemplates: Record<ModuleKey, [string, string, string?][]> = {
    passport: [['population', 'Xizmat ko‘rsatadigan aholi', 'nafar'], ['capacity', 'Quvvati', 'qabul/kun']],
    staff: [['doctors', 'Shifokorlar', 'nafar'], ['nurses', 'Hamshiralar', 'nafar'], ['vacancy', 'Vakant shtat', '%']],
    patients: [['attached', 'Biriktirilgan aholi', 'nafar'], ['chronic', 'Surunkali bemorlar', 'nafar']],
    admissions: [['daily', 'Kunlik qabul', 'ta'], ['monthly', 'Oylik qabul', 'ta']],
    diseases: [['newCases', 'Yangi aniqlangan', 'ta'], ['topDiagnosis', 'Yetakchi tashxis']],
    inpatient: [['beds', 'O‘rinlar', 'ta'], ['occupancy', 'O‘rin bandligi', '%']],
    digital: [['dmedActivity', 'DMED faolligi', '%'], ['ePrescription', 'Elektron retsept', '%']],
    equipment: [['computers', 'Kompyuterlar', 'ta'], ['faultyDevices', 'Nosoz qurilmalar', 'ta']],
    appeals: [['openAppeals', 'Ochiq murojaatlar', 'ta'], ['qrRating', 'QR baho', '5 dan']],
    kpi: [['score', 'KPI ball', '100 dan'], ['rank', 'Reyting o‘rni']]
  };
  return moduleDefinitions.map(m => ({
    key: m.key,
    label: m.label,
    status: 'unavailable',
    metrics: metricTemplates[m.key].map(([key, label, unit]) => unavailableMetric(key, label, unit))
  }));
}
