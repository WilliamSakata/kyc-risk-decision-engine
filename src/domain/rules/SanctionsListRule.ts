import { RiskRule, RiskEvaluationContext, RuleVote } from './RiskRule';

export class SanctionsListRule implements RiskRule {
  evaluate(context: RiskEvaluationContext): RuleVote {
    if (context.verification.sanctionsListHit) {
      return { outcome: 'DENY', reason: 'customer matched a sanctions list entry' };
    }

    return { outcome: 'APPROVE', reason: 'no sanctions list match' };
  }
}
