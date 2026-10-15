import { Pool } from 'pg';
import type { Institution } from '../domain/institution.js';

export type InstitutionRepository = {
  listByDistrict(districtKey: string): Promise<Institution[]>;
  findById(id: string): Promise<Institution | null>;
};

export function createInstitutionRepository(pool: Pool): InstitutionRepository {
  return {
    async listByDistrict(districtKey) {
      const result = await pool.query(
        `select id, official_name as "officialName", type, district_key as "districtKey", address, leader_name as "leaderName", phone, latitude, longitude
         from institutions where district_key = $1 order by official_name`,
        [districtKey]
      );
      return result.rows;
    },
    async findById(id) {
      const result = await pool.query(
        `select id, official_name as "officialName", type, district_key as "districtKey", address, leader_name as "leaderName", phone, latitude, longitude
         from institutions where id = $1`,
        [id]
      );
      return result.rows[0] ?? null;
    }
  };
}

export async function getMetric(pool: Pool, institutionId: string, metricKey: string) {
  const result = await pool.query(
    `select metric_key as "metricKey", metric_value as "metricValue", unit, source_type as "sourceType", source_name as "sourceName", fetched_at as "fetchedAt"
     from institution_metrics where institution_id = $1 and metric_key = $2 order by period desc limit 1`,
    [institutionId, metricKey]
  );
  return result.rows[0] ?? null;
}
