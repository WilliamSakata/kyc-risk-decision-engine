import { describe, it, expect } from 'vitest';
import { EvaluateRiskCheck } from '../../../src/application/use-cases/EvaluateRiskCheck';
import { RiskDecisionEngine } from '../../../src/domain/services/RiskDecisionEngine';
import { ScoreThresholdRule } from '../../../src/domain/rules/ScoreThresholdRule';
import { PriorDenialRule } from '../../../src/domain/rules/PriorDenialRule';
import { CustomerHistory } from '../../../src/domain/value-objects/CustomerHistory';
import { FakeRiskVerificationPort } from '../../fakes/FakeRiskVerificationPort';
import { FakeCustomerHistoryPort } from '../../fakes/FakeCustomerHistoryPort';

const input = { customerId: 'cus_1', customerName: 'Jane Doe', country: 'BR' };
const noHistory: CustomerHistory = { wasEverDenied: false, priorCheckCount: 0 };

function buildEngine(): RiskDecisionEngine {
  return new RiskDecisionEngine([new ScoreThresholdRule(), new PriorDenialRule()]);
}

describe('EvaluateRiskCheck', () => {
  it('approves a customer with a high score and no history', async () => {
    const verification = new FakeRiskVerificationPort({ score: 90, sanctionsListHit: false });
    const history = new FakeCustomerHistoryPort(noHistory);
    const useCase = new EvaluateRiskCheck(verification, history, buildEngine());

    const result = await useCase.execute(input);

    expect(result.customerId).toBe('cus_1');
    expect(result.decision).toBe('APPROVE');
    expect(result.riskScore).toBe(90);
  });

  it('records the decision in customer history', async () => {
    const verification = new FakeRiskVerificationPort({ score: 90, sanctionsListHit: false });
    const history = new FakeCustomerHistoryPort(noHistory);
    const useCase = new EvaluateRiskCheck(verification, history, buildEngine());

    await useCase.execute(input);

    expect(history.recorded).toHaveLength(1);
    expect(history.recorded[0].customerId).toBe('cus_1');
    expect(history.recorded[0].decision.outcome).toBe('APPROVE');
  });

  it('falls back to MANUAL_REVIEW with a null score when verification fails', async () => {
    const verification = new FakeRiskVerificationPort(new Error('network timeout'));
    const history = new FakeCustomerHistoryPort(noHistory);
    const useCase = new EvaluateRiskCheck(verification, history, buildEngine());

    const result = await useCase.execute(input);

    expect(result.decision).toBe('MANUAL_REVIEW');
    expect(result.reasons).toEqual(['risk verification unavailable']);
    expect(result.riskScore).toBeNull();
  });

  it('still records the fallback decision in customer history', async () => {
    const verification = new FakeRiskVerificationPort(new Error('network timeout'));
    const history = new FakeCustomerHistoryPort(noHistory);
    const useCase = new EvaluateRiskCheck(verification, history, buildEngine());

    await useCase.execute(input);

    expect(history.recorded).toHaveLength(1);
    expect(history.recorded[0].decision.outcome).toBe('MANUAL_REVIEW');
  });
});
