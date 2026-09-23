import { RiskRule, RiskEvaluationContext, RuleVote } from '../rules/RiskRule';
import { Decision, DecisionOutcome } from '../value-objects/Decision';

const SEVERITY: Record<DecisionOutcome, number> = {
  APPROVE: 0,
  MANUAL_REVIEW: 1,
  DENY: 2,
};

export class RiskDecisionEngine {
  constructor(private readonly rules: RiskRule[]) {}

  decide(context: RiskEvaluationContext): Decision {
    const votes: RuleVote[] = this.rules.map((rule) => rule.evaluate(context));

    const winningOutcome = votes.reduce<DecisionOutcome>(
      (mostSevere, vote) => (SEVERITY[vote.outcome] > SEVERITY[mostSevere] ? vote.outcome : mostSevere),
      'APPROVE',
    );

    const reasons = votes.filter((vote) => vote.outcome === winningOutcome).map((vote) => vote.reason);

    return { outcome: winningOutcome, reasons };
  }
}
