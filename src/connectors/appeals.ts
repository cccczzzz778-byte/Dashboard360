import { fetchJsonSource } from './types.js';
export const fetchAppealsSummary = (url = process.env.APPEALS_API_URL ?? '', token = process.env.APPEALS_API_TOKEN) => fetchJsonSource('appeals', url, { token, validate: (v): v is Record<string, unknown> => !!v && typeof v === 'object' });
