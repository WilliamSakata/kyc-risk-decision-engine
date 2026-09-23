import { describe, it, expect } from 'vitest';
import { ScoreThresholdRule } from '../../../../src/domain/rules/ScoreThresholdRule';
import { RiskEvaluationContext } from '../../../../src/domain/rules/RiskRule';

function contextWithScore(score: number): RiskEvaluationContext {
  return {
    verification: { score, sanctionsListHit: false },
    history: { wasEverDenied: false, priorCheckCount: 0 },
  };
}

describe('ScoreThresholdRule', () => {
  const rule = new ScoreThresholdRule();

  it('votes APPROVE when score is at or above 80', () => {
    expect(rule.evaluate(contextWithScore(80)).outcome).toBe('APPROVE');
    expect(rule.evaluate(contextWithScore(100)).outcome).toBe('APPROVE');
  });

  it('votes DENY when score is at or below 20', () => {
    expect(rule.evaluate(contextWithScore(20)).outcome).toBe('DENY');
    expect(rule.evaluate(contextWithScore(0)).outcome).toBe('DENY');
  });

  it('votes MANUAL_REVIEW when score is between 21 and 79', () => {
    expect(rule.evaluate(contextWithScore(21)).outcome).toBe('MANUAL_REVIEW');
    expect(rule.evaluate(contextWithScore(79)).outcome).toBe('MANUAL_REVIEW');
  });
});
