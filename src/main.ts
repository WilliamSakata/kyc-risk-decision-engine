import { createApp } from './adapters/inbound/http/app';
import { EvaluateRiskCheck } from './application/use-cases/EvaluateRiskCheck';
import { RiskDecisionEngine } from './domain/services/RiskDecisionEngine';
import { ScoreThresholdRule } from './domain/rules/ScoreThresholdRule';
import { PriorDenialRule } from './domain/rules/PriorDenialRule';
import { SanctionsListRule } from './domain/rules/SanctionsListRule';
import { HttpRiskVerificationAdapter } from './adapters/outbound/risk-verification/HttpRiskVerificationAdapter';
import { InMemoryCustomerHistoryRepository } from './adapters/outbound/history/InMemoryCustomerHistoryRepository';
import { loadEnv } from './config/env';

const env = loadEnv();

const decisionEngine = new RiskDecisionEngine([
  new ScoreThresholdRule(),
  new PriorDenialRule(),
  new SanctionsListRule(),
]);

const evaluateRiskCheck = new EvaluateRiskCheck(
  new HttpRiskVerificationAdapter(env.riskVerificationBaseUrl),
  new InMemoryCustomerHistoryRepository(),
  decisionEngine,
);

const app = createApp(evaluateRiskCheck);

app.listen(env.port, () => {
  console.log(`kyc-risk-decision-engine listening on port ${env.port}`);
});
