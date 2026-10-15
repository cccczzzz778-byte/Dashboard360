import { audit } from './log.js';

export type AuditQueryable = {
  query(sql: string, values?: unknown[]): Promise<unknown>;
};

export type SafeAuditValue = string | number | boolean | null;

const sensitiveKey = /(password|passwd|secret|token|cookie|authorization|credential|connection.?string|database.?url|redis.?url|api.?key|private.?key)/i;

function normalizeValue(value: unknown): SafeAuditValue {
  if (value == null) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 500);
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return '[unserializable]';
  }
}

export function sanitizeAuditMetadata(metadata: Record<string, unknown> = {}) {
  const result: Record<string, SafeAuditValue> = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 40)) {
    if (sensitiveKey.test(key)) continue;
    result[key.slice(0, 80)] = normalizeValue(value);
  }
  return result;
}

export type AuditRecorder = {
  record(event: string, metadata?: Record<string, unknown>): Promise<void>;
};

export function createAuditRecorder(pool?: AuditQueryable): AuditRecorder {
  return {
    async record(event, metadata = {}) {
      const safeEvent = String(event || 'unknown').slice(0, 120);
      const safe = sanitizeAuditMetadata(metadata);
      audit(safeEvent, safe);
      if (!pool) return;

      const username = typeof safe.username === 'string' ? safe.username.slice(0, 120) : null;
      const client = typeof safe.client === 'string' ? safe.client.slice(0, 120) : null;
      try {
        await pool.query(
          `insert into audit_events(event_type, actor_username, client_fingerprint, metadata)
           values($1,$2,$3,$4::jsonb)`,
          [safeEvent, username, client, JSON.stringify(safe)]
        );
      } catch {
        console.error(JSON.stringify({ type: 'audit_persist_error', event: safeEvent }));
      }
    }
  };
}
