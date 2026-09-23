import { describe, it, expect } from 'vitest';
import { RiskDecisionEngine } from '../../../../src/domain/services/RiskDecisionEngine';
import { RiskRule, RiskEvaluationContext, RuleVote } from '../../../../src/domain/rules/RiskRule';

class FixedVoteRule implements RiskRule {
  constructor(private readonly vote: RuleVote) {}

  evaluate(): RuleVote {
    return this.vote;
  }
}

const context: RiskEvaluationContext = {
  verification: { score: 50, sanctionsListHit: false },
  history: { wasEverDenied: false, priorCheckCount: 0 },
};

describe('RiskDecisionEngine', () => {
  it('returns APPROVE when every rule votes APPROVE', () => {
    const engine = new RiskDecisionEngine([
      new FixedVoteRule({ outcome: 'APPROVE', reason: 'a' }),
      new FixedVoteRule({ outcome: 'APPROVE', reason: 'b' }),
    ]);

    const decision = engine.decide(context);

    expect(decision.outcome).toBe('APPROVE');
    expect(decision.reasons).toEqual(['a', 'b']);
  });

  it('lets DENY win over APPROVE and MANUAL_REVIEW', () => {
    const engine = new RiskDecisionEngine([
      new FixedVoteRule({ outcome: 'APPROVE', reason: 'a' }),
      new FixedVoteRule({ outcome: 'MANUAL_REVIEW', reason: 'b' }),
      new FixedVoteRule({ outcome: 'DENY', reason: 'c' }),
    ]);

    const decision = engine.decide(context);

    expect(decision.outcome).toBe('DENY');
    expect(decision.reasons).toEqual(['c']);
  });

  it('lets MANUAL_REVIEW win over APPROVE when no DENY vote exists', () => {
    const engine = new RiskDecisionEngine([
      new FixedVoteRule({ outcome: 'APPROVE', reason: 'a' }),
      new FixedVoteRule({ outcome: 'MANUAL_REVIEW', reason: 'b' }),
    ]);

    const decision = engine.decide(context);

    expect(decision.outcome).toBe('MANUAL_REVIEW');
    expect(decision.reasons).toEqual(['b']);
  });

  it('only surfaces reasons from votes matching the winning severity', () => {
    const engine = new RiskDecisionEngine([
      new FixedVoteRule({ outcome: 'APPROVE', reason: 'neutral' }),
      new FixedVoteRule({ outcome: 'DENY', reason: 'flagged' }),
      new FixedVoteRule({ outcome: 'DENY', reason: 'also flagged' }),
    ]);

    const decision = engine.decide(context);

    expect(decision.reasons).toEqual(['flagged', 'also flagged']);
  });

  it('returns APPROVE with no reasons when there are no rules', () => {
    const engine = new RiskDecisionEngine([]);

    expect(engine.decide(context)).toEqual({ outcome: 'APPROVE', reasons: [] });
  });
});
