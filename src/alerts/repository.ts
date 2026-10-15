import type { Pool } from 'pg';
import type { AlertCandidate } from './engine.js';

export type StoredAlert = AlertCandidate & {
  id: number;
  status: 'open' | 'acknowledged' | 'resolved' | 'closed';
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

function isoOrNull(value: unknown) {
  if (value == null) return null;
  const date = new Date(value as any);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function mapAlert(row: any): StoredAlert {
  return {
    id: Number(row.id),
    institutionId: row.institutionId ?? null,
    sourceKey: row.sourceKey ?? null,
    alertType: row.alertType,
    severity: row.severity,
    title: row.title,
    reason: row.reason,
    dedupKey: row.dedupKey,
    metadata: row.metadata ?? {},
    status: row.status,
    firstSeenAt: isoOrNull(row.firstSeenAt),
    lastSeenAt: isoOrNull(row.lastSeenAt)
  };
}

export function createAlertRepository(pool: Pool) {
  return {
    async upsertActive(candidate: AlertCandidate): Promise<StoredAlert> {
      const result = await pool.query(
        `insert into alerts(institution_id, source_key, alert_type, severity, title, reason, dedup_key, metadata, first_seen_at, last_seen_at)
         values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now(),now())
         on conflict(dedup_key) where status in ('open','acknowledged')
         do update set severity=excluded.severity, title=excluded.title, reason=excluded.reason,
           source_key=excluded.source_key, institution_id=excluded.institution_id,
           metadata=excluded.metadata, last_seen_at=now()
         returning id, institution_id as "institutionId", source_key as "sourceKey", alert_type as "alertType",
           severity, title, reason, dedup_key as "dedupKey", metadata, status,
           first_seen_at as "firstSeenAt", last_seen_at as "lastSeenAt"`,
        [candidate.institutionId, candidate.sourceKey, candidate.alertType, candidate.severity,
          candidate.title, candidate.reason, candidate.dedupKey, JSON.stringify(candidate.metadata ?? {})]
      );
      return mapAlert(result.rows[0]);
    },

    async listActive(): Promise<StoredAlert[]> {
      const result = await pool.query(
        `select id, institution_id as "institutionId", source_key as "sourceKey", alert_type as "alertType",
                severity, title, reason, dedup_key as "dedupKey", metadata, status,
                first_seen_at as "firstSeenAt", last_seen_at as "lastSeenAt"
           from alerts where status in ('open','acknowledged')
          order by case severity when 'critical' then 1 when 'warning' then 2 else 3 end, last_seen_at desc`
      );
      return result.rows.map(mapAlert);
    },

    async acknowledge(id: number) {
      const result = await pool.query(
        `update alerts set status='acknowledged', acknowledged_at=coalesce(acknowledged_at,now()), last_seen_at=last_seen_at
          where id=$1 and status='open'
          returning id`,
        [id]
      );
      return Boolean(result.rows[0]);
    },

    async resolve(id: number) {
      const result = await pool.query(
        `update alerts set status='resolved', resolved_at=coalesce(resolved_at,now())
          where id=$1 and status in ('open','acknowledged')
          returning id`,
        [id]
      );
      return Boolean(result.rows[0]);
    }
  };
}
