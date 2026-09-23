import { DecisionOutcome } from '../../domain/value-objects/Decision';

export interface EvaluateRiskCheckOutput {
  customerId: string;
  decision: DecisionOutcome;
  reasons: string[];
  riskScore: number | null;
}
