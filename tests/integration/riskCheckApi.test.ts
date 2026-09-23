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

let mockServer: Server;
let app: Express;

beforeAll(async () => {
  const mockApp = express();
  mockApp.use(express.json());
  mockApp.post('/verifications', (req, res) => {
    const { customerId } = req.body as { customerId: string };
    res.status(200).json({ score: 90, sanctionsListHit: customerId === 'cus_sanctioned' });
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

describe('POST /risk-checks (integration)', () => {
  it('approves a customer that clears verification with a high score', async () => {
    const response = await request(app)
      .post('/risk-checks')
      .send({ customerId: 'cus_ok', customerName: 'Jane Doe', country: 'BR' });

    expect(response.status).toBe(200);
    expect(response.body.decision).toBe('APPROVE');
    expect(response.body.riskScore).toBe(90);
  });

  it('denies a customer that matches the sanctions list, even with a high score', async () => {
    const response = await request(app)
      .post('/risk-checks')
      .send({ customerId: 'cus_sanctioned', customerName: 'John Roe', country: 'BR' });

    expect(response.status).toBe(200);
    expect(response.body.decision).toBe('DENY');
  });
});
