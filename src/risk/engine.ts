import type { RiskFactorInput, RiskFactorResult, RiskResult, RiskSeverity } from './types.js';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const clampRisk = (value: number) => Math.max(0, Math.min(100, value));

function severityFor(score: number | null): RiskSeverity {
  if (score == null) return 'unavailable';
  if (score < 40) return 'green';
  if (score < 70) return 'amber';
  return 'red';
}

function factorAvailable(factor: RiskFactorInput) {
  return factor.normalizedRisk != null && !['unavailable', 'error'].includes(factor.sourceState);
}

export function calculateRisk(inputs: RiskFactorInput[]): RiskResult {
  if (inputs.some(input => !Number.isFinite(input.weight) || input.weight <= 0)) {
    throw new Error('risk factor weight must be greater than zero');
  }

  const totalWeight = inputs.reduce((sum, input) => sum + input.weight, 0);
  if (totalWeight === 0) return { score: null, severity: 'unavailable', coveragePct: 0, factors: [] };

  const normalized = inputs.map(input => ({
    ...input,
    normalizedRisk: input.normalizedRisk == null ? null : clampRisk(input.normalizedRisk)
  }));
  const covered = normalized.filter(factorAvailable);
  const coveredWeight = covered.reduce((sum, input) => sum + input.weight, 0);
  const coveragePct = round2((coveredWeight / totalWeight) * 100);

  if (!coveredWeight) {
    return {
      score: null,
      severity: 'unavailable',
      coveragePct,
      factors: normalized.map(input => ({ ...input, contribution: null }))
    };
  }

  const weightedTotal = covered.reduce((sum, input) => sum + (input.normalizedRisk as number) * input.weight, 0);
  const score = round2(weightedTotal / coveredWeight);
  const factors: RiskFactorResult[] = normalized.map(input => ({
    ...input,
    contribution: factorAvailable(input)
      ? round2(((input.normalizedRisk as number) * input.weight) / coveredWeight)
      : null
  }));

  return { score, severity: severityFor(score), coveragePct, factors };
}
