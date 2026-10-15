export const SITUATION_MAP_DEFAULTS = {
  center: [64.34, 39.82] as [number, number],
  zoom: 8.35,
  pitch: 55,
  bearing: -12
} as const;

export const SITUATION_MAP_DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export type MapStyleResolution = {
  external: boolean;
  styleUrl: string | null;
};

export function resolveMapStyle(input: { url?: string | null; allowedHosts?: string[] } = {}): MapStyleResolution {
  const raw = input.url?.trim();
  if (!raw) {
    return { external: true, styleUrl: SITUATION_MAP_DEFAULT_STYLE_URL };
  }
  try {
    const parsed = new URL(raw);
    const allowed = new Set((input.allowedHosts ?? []).map(host => host.trim().toLowerCase()).filter(Boolean));
    if (parsed.protocol !== 'https:' || !allowed.has(parsed.hostname.toLowerCase())) {
      return { external: false, styleUrl: null };
    }
    return { external: true, styleUrl: parsed.toString() };
  } catch {
    return { external: false, styleUrl: null };
  }
}
