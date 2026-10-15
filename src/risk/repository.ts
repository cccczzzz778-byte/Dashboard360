import type { Pool } from 'pg';
import type { RiskResult } from './types.js';

export type StoredRisk = RiskResult & {
  id: number;
  institutionId: string;
  calculatedAt: string;
};

export function createRiskRepository(pool: Pool) {
  return {
    async save(institutionId: string, risk: RiskResult): Promise<number> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = await client.query(
          `insert into risk_scores(institution_id, score, severity, coverage_pct, calculated_at)
           values($1,$2,$3,$4,now()) returning id`,
          [institutionId, risk.score, risk.severity, risk.coveragePct]
        );
        const riskScoreId = Number(inserted.rows[0].id);
        for (const factor of risk.factors) {
          await client.query(
            `insert into risk_factors(risk_score_id, factor_key, weight, normalized_risk, source_state, contribution)
             values($1,$2,$3,$4,$5,$6)`,
            [riskScoreId, factor.key, factor.weight, factor.normalizedRisk, factor.sourceState, factor.contribution]
          );
        }
        await client.query('COMMIT');
        return riskScoreId;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async latest(institutionId: string): Promise<StoredRisk | null> {
      const score = await pool.query(
        `select id, institution_id as "institutionId", score, severity, coverage_pct as "coveragePct",
                calculated_at as "calculatedAt"
           from risk_scores where institution_id=$1 order by calculated_at desc, id desc limit 1`,
        [institutionId]
      );
      if (!score.rows[0]) return null;
      const row = score.rows[0];
      const factors = await pool.query(
        `select factor_key as key, weight, normalized_risk as "normalizedRisk", source_state as "sourceState", contribution
           from risk_factors where risk_score_id=$1 order by id`,
        [row.id]
      );
      return {
        id: Number(row.id),
        institutionId: row.institutionId,
        score: row.score == null ? null : Number(row.score),
        severity: row.severity,
        coveragePct: Number(row.coveragePct),
        calculatedAt: new Date(row.calculatedAt).toISOString(),
        factors: factors.rows.map(factor => ({
          ...factor,
          weight: Number(factor.weight),
          normalizedRisk: factor.normalizedRisk == null ? null : Number(factor.normalizedRisk),
          contribution: factor.contribution == null ? null : Number(factor.contribution)
        }))
      };
    },

    async listLatest(): Promise<StoredRisk[]> {
      const result = await pool.query(
        `select distinct on(institution_id) id, institution_id as "institutionId", score, severity,
                coverage_pct as "coveragePct", calculated_at as "calculatedAt"
           from risk_scores order by institution_id, calculated_at desc, id desc`
      );
      return result.rows.map(row => ({
        id: Number(row.id), institutionId: row.institutionId,
        score: row.score == null ? null : Number(row.score), severity: row.severity,
        coveragePct: Number(row.coveragePct), calculatedAt: new Date(row.calculatedAt).toISOString(), factors: []
      }));
    }
  };
}
