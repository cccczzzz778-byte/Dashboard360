import { fetchJsonSource } from './types.js';
export const fetchQrSummary = (url = process.env.QR_API_URL ?? '', token = process.env.QR_API_TOKEN) => fetchJsonSource('qr', url, { token, validate: (v): v is Record<string, unknown> => !!v && typeof v === 'object' });
