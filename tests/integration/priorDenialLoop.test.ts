import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { createServer, Server } from 'node:http';
import { createApp } from '../../src/adapters/inbound/http/app';
import { EvaluateRiskCheck } from '../../src/application/use-cases/EvaluateRiskCheck';
import { RiskDecisionEngine } from '../../src/domain/services/RiskDecisionEngine';
import { ScoreThresholdRule } from '../../src/domain/rules/ScoreThresholdRule';
import { PriorDenialRule } from '../../src/domain/rules/PriorDenialRule';
import { SanctionsListRule } from '../../src/domain/rules/SanctionsListRule';
import { HttpRiskVerificationAdapter } from '../../src/adapters/outbound/risk-verification/HttpRiskVerificationAdapter';
import { InMemoryCustomerHistoryRepository } from '../../src/adapters/outbound/history/InMemoryCustomerHistoryRepository';

// This test uses a small stateful local mock, distinct from the shipped
// mock-risk-verification-server (which is intentionally deterministic per
// customerId). Demonstrating the prior-denial loop requires the *same*
// customerId to score differently across two calls, which the deterministic
// shipped mock cannot do by design.
let mockServer: Server;
let app: Express;
let callCount = 0;

beforeAll(async () => {
  const mockApp = express();
  mockApp.use(express.json());
  mockApp.post('/verifications', (_req, res) => {
    callCount += 1;
    const score = callCount === 1 ? 10 : 90;
    res.status(200).json({ score, sanctionsListHit: false });
  });

  mockServer = createServer(mockApp);
  await new Promise<void>((resolve) => mockServer.listen(0, resolve));
  const address = mockServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('failed to determine mock server address');
  }
  const mockServerUrl = `http://127.0.0.1:${address.port}`;

  const decisionEngine = new RiskDecisionEngine([
    new ScoreThresholdRule(),
    new PriorDenialRule(),
    new SanctionsListRule(),
  ]);

  const evaluateRiskCheck = new EvaluateRiskCheck(
    new HttpRiskVerificationAdapter(mockServerUrl),
    new InMemoryCustomerHistoryRepository(),
    decisionEngine,
  );

  app = createApp(evaluateRiskCheck);
});

afterAll(() => {
  mockServer.close();
});

describe('Prior denial affects a later check for the same customer (integration)', () => {
  it('denies the customer on the first check with a low score', async () => {
    const response = await request(app)
      .post('/risk-checks')
      .send({ customerId: 'cus_loop', customerName: 'Jane Doe', country: 'BR' });

    expect(response.status).toBe(200);
    expect(response.body.decision).toBe('DENY');
    expect(response.body.riskScore).toBe(10);
  });

  it('flags the same customer for manual review on a later check, even with a high score', async () => {
    const response = await request(app)
      .post('/risk-checks')
      .send({ customerId: 'cus_loop', customerName: 'Jane Doe', country: 'BR' });

    expect(response.status).toBe(200);
    expect(response.body.decision).toBe('MANUAL_REVIEW');
    expect(response.body.riskScore).toBe(90);
    expect(response.body.reasons).toContain('customer has a prior denial on record');
  });
});
