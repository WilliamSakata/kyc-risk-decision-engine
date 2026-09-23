import { describe, it, expect } from 'vitest';
import { SanctionsListRule } from '../../../../src/domain/rules/SanctionsListRule';
import { RiskEvaluationContext } from '../../../../src/domain/rules/RiskRule';

function contextWithSanctionsHit(sanctionsListHit: boolean): RiskEvaluationContext {
  return {
    verification: { score: 90, sanctionsListHit },
    history: { wasEverDenied: false, priorCheckCount: 0 },
  };
}

describe('SanctionsListRule', () => {
  const rule = new SanctionsListRule();

  it('votes DENY when the customer matches the sanctions list, regardless of score', () => {
    expect(rule.evaluate(contextWithSanctionsHit(true)).outcome).toBe('DENY');
  });

  it('votes APPROVE when there is no sanctions list match', () => {
    expect(rule.evaluate(contextWithSanctionsHit(false)).outcome).toBe('APPROVE');
  });
});
