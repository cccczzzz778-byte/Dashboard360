import type { Pool } from 'pg';

/**
 * Enterprise schema is intentionally additive. Existing institution/metric/audit
 * tables remain the source of truth while the enterprise control plane is rolled
 * out behind new APIs.
 */
export async function ensureEnterpriseSchema(pool: Pool): Promise<void> {
  await pool.query(`
    create table if not exists users (
      id text primary key,
      username text not null unique,
      password_hash text not null,
      role text not null check (role in ('super_admin','executive','regional_specialist','district_manager','institution_manager','viewer')),
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists users_role_active_idx on users(role, is_active);

    create table if not exists user_scopes (
      id bigserial primary key,
      user_id text not null references users(id) on delete cascade,
      district_key text,
      institution_id text references institutions(id) on delete cascade,
      created_at timestamptz not null default now(),
      check (district_key is not null or institution_id is not null)
    );
    create unique index if not exists user_scopes_unique_district_idx
      on user_scopes(user_id, district_key) where district_key is not null and institution_id is null;
    create unique index if not exists user_scopes_unique_institution_idx
      on user_scopes(user_id, institution_id) where institution_id is not null;

    create table if not exists sessions (
      token_hash text primary key,
      user_id text not null references users(id) on delete cascade,
      csrf_token text not null,
      client_fingerprint text,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      expires_at timestamptz not null,
      revoked_at timestamptz
    );
    create index if not exists sessions_user_active_idx on sessions(user_id, revoked_at, expires_at);
    create index if not exists sessions_expiry_last_seen_idx on sessions(expires_at, last_seen_at);

    create table if not exists integration_sources (
      source_key text primary key,
      label text not null,
      enabled boolean not null default true,
      auth_state text not null default 'unavailable',
      stale_after_seconds integer not null default 3600 check (stale_after_seconds > 0),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists integration_runs (
      id bigserial primary key,
      source_key text not null references integration_sources(source_key) on delete cascade,
      status text not null check (status in ('success','degraded','failed','auth_required')),
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      latency_ms integer,
      error_code text,
      metadata jsonb not null default '{}'::jsonb
    );
    create index if not exists integration_runs_source_started_idx on integration_runs(source_key, started_at desc);
    create index if not exists integration_runs_source_success_idx on integration_runs(source_key, status, finished_at desc);

    create table if not exists risk_scores (
      id bigserial primary key,
      institution_id text not null references institutions(id) on delete cascade,
      score numeric(5,2),
      severity text not null check (severity in ('green','amber','red','unavailable')),
      coverage_pct numeric(5,2) not null check (coverage_pct >= 0 and coverage_pct <= 100),
      calculated_at timestamptz not null default now()
    );
    create index if not exists risk_scores_institution_calculated_idx on risk_scores(institution_id, calculated_at desc);

    create table if not exists risk_factors (
      id bigserial primary key,
      risk_score_id bigint not null references risk_scores(id) on delete cascade,
      factor_key text not null,
      weight numeric(10,4) not null,
      normalized_risk numeric(6,2),
      source_state text not null,
      contribution numeric(10,4),
      metadata jsonb not null default '{}'::jsonb
    );
    create index if not exists risk_factors_score_idx on risk_factors(risk_score_id);

    create table if not exists alerts (
      id bigserial primary key,
      dedup_key text not null,
      institution_id text references institutions(id) on delete cascade,
      source_key text references integration_sources(source_key) on delete set null,
      alert_type text not null,
      severity text not null check (severity in ('info','warning','critical')),
      title text not null,
      reason text not null,
      status text not null default 'open' check (status in ('open','acknowledged','resolved','closed')),
      first_seen_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      acknowledged_at timestamptz,
      resolved_at timestamptz,
      metadata jsonb not null default '{}'::jsonb
    );
    create unique index if not exists alerts_active_dedup_idx
      on alerts(dedup_key) where status in ('open','acknowledged');
    create index if not exists alerts_status_severity_updated_idx on alerts(status, severity, last_seen_at desc);
    create index if not exists alerts_institution_created_idx on alerts(institution_id, first_seen_at desc);
  `);
}
