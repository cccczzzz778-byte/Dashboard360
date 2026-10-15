export type RiskSeverity = 'green' | 'amber' | 'red' | 'unavailable';

export type RiskFactorInput = {
  key: string;
  weight: number;
  normalizedRisk: number | null;
  sourceState: string;
};

export type RiskFactorResult = RiskFactorInput & {
  normalizedRisk: number | null;
  contribution: number | null;
};

export type RiskResult = {
  score: number | null;
  severity: RiskSeverity;
  coveragePct: number;
  factors: RiskFactorResult[];
};
