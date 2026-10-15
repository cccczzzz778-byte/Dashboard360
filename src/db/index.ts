import { Pool } from 'pg';
import type { Institution, InstitutionMetric } from '../domain/institution.js';

export type InstitutionRepository = {
  listAll(): Promise<Institution[]>;
  listByDistrict(districtKey: string): Promise<Institution[]>;
  findById(id: string): Promise<Institution | null>;
};

const institutionSelect = `select id, official_name as "officialName", type, district_key as "districtKey", address,
  leader_name as "leaderName", phone, latitude, longitude, location_accuracy as "locationAccuracy" from institutions`;

export function createInstitutionRepository(pool: Pool): InstitutionRepository {
  return {
    async listAll() {
      const result = await pool.query(`${institutionSelect} order by district_key, official_name`);
      return result.rows;
    },
    async listByDistrict(districtKey) {
      const result = await pool.query(`${institutionSelect} where district_key = $1 order by official_name`, [districtKey]);
      return result.rows;
    },
    async findById(id) {
      const result = await pool.query(`${institutionSelect} where id = $1`, [id]);
      return result.rows[0] ?? null;
    }
  };
}

export async function ensureSchema(pool: Pool, institutions: Institution[]) {
  await pool.query(`
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
      location_accuracy text default 'unknown',
      updated_at timestamptz not null default now()
    );
    create index if not exists institutions_district_idx on institutions(district_key);
    create table if not exists institution_metrics (
      institution_id text not null references institutions(id) on delete cascade,
      metric_key text not null,
      metric_value text,
      unit text,
      source_type text not null default 'manual',
      source_name text,
      period date not null default current_date,
      fetched_at timestamptz not null default now(),
      primary key (institution_id, metric_key, period)
    );
    create table if not exists audit_events (
      id bigserial primary key,
      event_type text not null,
      actor_username text,
      client_fingerprint text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists audit_events_created_idx on audit_events(created_at desc);
    create index if not exists audit_events_type_idx on audit_events(event_type, created_at desc);
  `);
  for (const institution of institutions) {
    await pool.query(
      `insert into institutions(id, official_name, type, district_key, address, leader_name, phone, latitude, longitude, location_accuracy)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict(id) do update set official_name=excluded.official_name, type=excluded.type, district_key=excluded.district_key,
         latitude=coalesce(institutions.latitude, excluded.latitude), longitude=coalesce(institutions.longitude, excluded.longitude),
         location_accuracy=case when institutions.location_accuracy is null or institutions.location_accuracy='unknown' then excluded.location_accuracy else institutions.location_accuracy end`,
      [institution.id, institution.officialName, institution.type, institution.districtKey, institution.address, institution.leaderName,
       institution.phone, institution.latitude, institution.longitude, institution.locationAccuracy ?? 'unknown']
    );
  }
}

export async function listLatestMetrics(pool: Pool, institutionId: string): Promise<InstitutionMetric[]> {
  const result = await pool.query(
    `select distinct on(metric_key) metric_key as "metricKey", metric_value as "metricValue", unit,
       source_type as "sourceType", source_name as "sourceName", fetched_at as "fetchedAt"
     from institution_metrics where institution_id=$1 order by metric_key, period desc, fetched_at desc`,
    [institutionId]
  );
  return result.rows;
}

export async function upsertManualMetric(pool: Pool, input: { institutionId: string; metricKey: string; value: string | number | null; unit?: string | null }) {
  const result = await pool.query(
    `insert into institution_metrics(institution_id, metric_key, metric_value, unit, source_type, source_name, period, fetched_at)
     values($1,$2,$3,$4,'manual','Buxoro SSB 360',current_date,now())
     on conflict(institution_id, metric_key, period) do update set metric_value=excluded.metric_value, unit=excluded.unit,
       source_type='manual', source_name='Buxoro SSB 360', fetched_at=now()
     returning metric_key as "metricKey", metric_value as "metricValue", unit, source_type as "sourceType", source_name as "sourceName", fetched_at as "fetchedAt"`,
    [input.institutionId, input.metricKey, input.value == null ? null : String(input.value), input.unit ?? null]
  );
  return result.rows[0];
}

export async function getMetric(pool: Pool, institutionId: string, metricKey: string) {
  const result = await pool.query(
    `select metric_key as "metricKey", metric_value as "metricValue", unit, source_type as "sourceType", source_name as "sourceName", fetched_at as "fetchedAt"
     from institution_metrics where institution_id = $1 and metric_key = $2 order by period desc limit 1`,
    [institutionId, metricKey]
  );
  return result.rows[0] ?? null;
}
