import { describe, it, expect } from 'vitest';
import { PriorDenialRule } from '../../../../src/domain/rules/PriorDenialRule';
import { RiskEvaluationContext } from '../../../../src/domain/rules/RiskRule';

function contextWithHistory(wasEverDenied: boolean): RiskEvaluationContext {
  return {
    verification: { score: 50, sanctionsListHit: false },
    history: { wasEverDenied, priorCheckCount: 1 },
  };
}

describe('PriorDenialRule', () => {
  const rule = new PriorDenialRule();

  it('votes MANUAL_REVIEW when the customer has a prior denial', () => {
    expect(rule.evaluate(contextWithHistory(true)).outcome).toBe('MANUAL_REVIEW');
  });

  it('votes APPROVE when the customer has no prior denial', () => {
    expect(rule.evaluate(contextWithHistory(false)).outcome).toBe('APPROVE');
  });
});
