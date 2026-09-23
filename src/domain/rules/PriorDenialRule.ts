import { RiskRule, RiskEvaluationContext, RuleVote } from './RiskRule';

export class PriorDenialRule implements RiskRule {
  evaluate(context: RiskEvaluationContext): RuleVote {
    if (context.history.wasEverDenied) {
      return { outcome: 'MANUAL_REVIEW', reason: 'customer has a prior denial on record' };
    }

    return { outcome: 'APPROVE', reason: 'no prior denial on record' };
  }
}
