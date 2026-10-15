export type SourceResult<T> =
  | { ok: true; data: T; fetchedAt: string; source: string }
  | { ok: false; code: 'timeout' | 'auth_required' | 'invalid_payload' | 'unavailable'; fetchedAt: string; source: string };

export async function fetchJsonSource<T>(source: string, url: string, options: { token?: string; timeoutMs?: number; validate: (value: unknown) => value is T }): Promise<SourceResult<T>> {
  const fetchedAt = new Date().toISOString();
  if (!url) return { ok: false, code: 'unavailable', fetchedAt, source };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: options.token ? { authorization: `Bearer ${options.token}` } : undefined
    });
    if (response.status === 401 || response.status === 403) return { ok: false, code: 'auth_required', fetchedAt, source };
    if (!response.ok) return { ok: false, code: 'unavailable', fetchedAt, source };
    const data = await response.json();
    if (!options.validate(data)) return { ok: false, code: 'invalid_payload', fetchedAt, source };
    return { ok: true, data, fetchedAt, source };
  } catch (error: any) {
    return { ok: false, code: error?.name === 'AbortError' ? 'timeout' : 'unavailable', fetchedAt, source };
  } finally { clearTimeout(timer); }
}
