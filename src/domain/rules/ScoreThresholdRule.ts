import { RiskRule, RiskEvaluationContext, RuleVote } from './RiskRule';

export class ScoreThresholdRule implements RiskRule {
  evaluate(context: RiskEvaluationContext): RuleVote {
    const { score } = context.verification;

    if (score >= 80) {
      return { outcome: 'APPROVE', reason: `score ${score} is at or above the approval threshold (80)` };
    }

    if (score <= 20) {
      return { outcome: 'DENY', reason: `score ${score} is at or below the denial threshold (20)` };
    }

    return { outcome: 'MANUAL_REVIEW', reason: `score ${score} is in the manual review range (21-79)` };
  }
}
