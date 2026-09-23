import { RiskVerificationResult } from '../value-objects/RiskVerificationResult';
import { CustomerHistory } from '../value-objects/CustomerHistory';
import { DecisionOutcome } from '../value-objects/Decision';

export interface RiskEvaluationContext {
  verification: RiskVerificationResult;
  history: CustomerHistory;
}

export interface RuleVote {
  outcome: DecisionOutcome;
  reason: string;
}

export interface RiskRule {
  evaluate(context: RiskEvaluationContext): RuleVote;
}
