import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/adapters/inbound/http/app';
import { EvaluateRiskCheck } from '../../../src/application/use-cases/EvaluateRiskCheck';
import { RiskDecisionEngine } from '../../../src/domain/services/RiskDecisionEngine';
import { ScoreThresholdRule } from '../../../src/domain/rules/ScoreThresholdRule';
import { FakeRiskVerificationPort } from '../../fakes/FakeRiskVerificationPort';
import { FakeCustomerHistoryPort } from '../../fakes/FakeCustomerHistoryPort';

function buildApp(score: number) {
  const evaluateRiskCheck = new EvaluateRiskCheck(
    new FakeRiskVerificationPort({ score, sanctionsListHit: false }),
    new FakeCustomerHistoryPort({ wasEverDenied: false, priorCheckCount: 0 }),
    new RiskDecisionEngine([new ScoreThresholdRule()]),
  );
  return createApp(evaluateRiskCheck);
}

describe('POST /risk-checks', () => {
  it('returns 200 with the decision for a valid request', async () => {
    const app = buildApp(90);

    const response = await request(app)
      .post('/risk-checks')
      .send({ customerId: 'cus_1', customerName: 'Jane Doe', country: 'BR' });

    expect(response.status).toBe(200);
    expect(response.body.customerId).toBe('cus_1');
    expect(response.body.decision).toBe('APPROVE');
    expect(response.body.riskScore).toBe(90);
  });

  it('returns 400 when the request body is invalid', async () => {
    const app = buildApp(90);

    const response = await request(app).post('/risk-checks').send({ customerId: 'cus_1' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid request body');
  });
});
