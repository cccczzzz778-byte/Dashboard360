create table if not exists institutions (
  id text primary key,
  official_name text not null,
  type text not null,
  district_key text not null,
  address text,
  leader_name text,
  phone text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists institution_metrics (
  id bigserial primary key,
  institution_id text not null references institutions(id) on delete cascade,
  metric_key text not null,
  metric_value numeric,
  unit text,
  source_type text not null,
  source_name text,
  fetched_at timestamptz,
  period date,
  created_at timestamptz not null default now()
);

create table if not exists institution_sources (
  id bigserial primary key,
  institution_id text not null references institutions(id) on delete cascade,
  source_key text not null,
  source_type text not null,
  status text not null default 'unavailable',
  last_success_at timestamptz,
  last_error_code text,
  unique(institution_id, source_key)
);

create index if not exists institutions_district_idx on institutions(district_key);
create index if not exists institution_metrics_lookup_idx on institution_metrics(institution_id, metric_key, period desc);
