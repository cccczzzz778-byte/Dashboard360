import { fetchJsonSource } from './types.js';
export const fetchKpiSummary = (url = process.env.KPI_API_URL ?? '', token = process.env.KPI_API_TOKEN) => fetchJsonSource('kpi', url, { token, validate: (v): v is Record<string, unknown> => !!v && typeof v === 'object' });
