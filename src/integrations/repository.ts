import type { Pool } from 'pg';
import { evaluateFreshness, type IntegrationRunStatus } from './freshness.js';

export type IntegrationSourceInput = {
  key: string;
  label: string;
  enabled: boolean;
  authState: string;
  staleAfterSeconds: number;
};

export type IntegrationRunInput = {
  sourceKey: string;
  status: IntegrationRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  latencyMs: number | null;
  errorCode: string | null;
  metadata?: Record<string, unknown>;
};

export type IntegrationHealth = {
  key: string;
  label: string;
  enabled: boolean;
  authState: string;
  status: ReturnType<typeof evaluateFreshness>['status'];
  lastSuccessAt: string | null;
  lastRunAt: string | null;
  latencyMs: number | null;
  errorCode: string | null;
  staleAfterSeconds: number;
  ageMs: number | null;
};

export function createIntegrationRepository(pool: Pool) {
  return {
    async upsertSource(input: IntegrationSourceInput) {
      if (!Number.isFinite(input.staleAfterSeconds) || input.staleAfterSeconds <= 0) throw new Error('invalid stale threshold');
      await pool.query(
        `insert into integration_sources(source_key, label, enabled, auth_state, stale_after_seconds, updated_at)
         values($1,$2,$3,$4,$5,now())
         on conflict(source_key) do update set label=excluded.label, enabled=excluded.enabled,
           auth_state=excluded.auth_state, stale_after_seconds=excluded.stale_after_seconds, updated_at=now()`,
        [input.key, input.label, input.enabled, input.authState, input.staleAfterSeconds]
      );
    },

    async recordRun(input: IntegrationRunInput) {
      await pool.query(
        `insert into integration_runs(source_key, status, started_at, finished_at, latency_ms, error_code, metadata)
         values($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [input.sourceKey, input.status, input.startedAt, input.finishedAt, input.latencyMs, input.errorCode, JSON.stringify(input.metadata ?? {})]
      );
    },

    async listHealth(now = new Date()): Promise<IntegrationHealth[]> {
      const result = await pool.query(
        `select s.source_key as key, s.label, s.enabled, s.auth_state as "authState",
                s.stale_after_seconds as "staleAfterSeconds",
                latest.status as "lastStatus", latest.started_at as "lastRunAt",
                latest.latency_ms as "latencyMs", latest.error_code as "errorCode",
                success.finished_at as "lastSuccessAt"
           from integration_sources s
           left join lateral (
             select status, started_at, latency_ms, error_code
               from integration_runs r where r.source_key=s.source_key
               order by r.started_at desc, r.id desc limit 1
           ) latest on true
           left join lateral (
             select finished_at from integration_runs r
              where r.source_key=s.source_key and r.status='success' and r.finished_at is not null
              order by r.finished_at desc, r.id desc limit 1
           ) success on true
          order by s.label`
      );

      return result.rows.map(row => {
        if (!row.enabled) {
          return {
            key: row.key, label: row.label, enabled: false, authState: row.authState,
            status: 'unavailable' as const, lastSuccessAt: row.lastSuccessAt ? new Date(row.lastSuccessAt).toISOString() : null,
            lastRunAt: row.lastRunAt ? new Date(row.lastRunAt).toISOString() : null,
            latencyMs: row.latencyMs == null ? null : Number(row.latencyMs), errorCode: row.errorCode ?? null,
            staleAfterSeconds: Number(row.staleAfterSeconds), ageMs: null
          };
        }
        const freshness = evaluateFreshness({
          now,
          staleAfterMs: Number(row.staleAfterSeconds) * 1000,
          lastStatus: row.lastStatus ?? null,
          lastSuccessAt: row.lastSuccessAt ?? null
        });
        return {
          key: row.key,
          label: row.label,
          enabled: Boolean(row.enabled),
          authState: row.authState,
          status: freshness.status,
          lastSuccessAt: row.lastSuccessAt ? new Date(row.lastSuccessAt).toISOString() : null,
          lastRunAt: row.lastRunAt ? new Date(row.lastRunAt).toISOString() : null,
          latencyMs: row.latencyMs == null ? null : Number(row.latencyMs),
          errorCode: row.errorCode ?? null,
          staleAfterSeconds: Number(row.staleAfterSeconds),
          ageMs: freshness.ageMs
        };
      });
    }
  };
}
