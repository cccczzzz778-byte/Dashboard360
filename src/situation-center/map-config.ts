export const SITUATION_MAP_DEFAULTS = {
  center: [64.34, 39.82] as [number, number],
  zoom: 8.35,
  pitch: 55,
  bearing: -12
} as const;

export type MapStyleResolution = {
  external: boolean;
  styleUrl: string | null;
};

export function resolveMapStyle(input: { url?: string | null; allowedHosts?: string[] } = {}): MapStyleResolution {
  const raw = input.url?.trim();
  if (!raw) return { external: false, styleUrl: null };
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
