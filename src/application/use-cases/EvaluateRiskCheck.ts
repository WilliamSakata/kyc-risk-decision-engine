import { RiskDecisionEngine } from '../../domain/services/RiskDecisionEngine';
import { Decision } from '../../domain/value-objects/Decision';
import { RiskVerificationResult } from '../../domain/value-objects/RiskVerificationResult';
import { RiskVerificationPort } from '../ports/RiskVerificationPort';
import { CustomerHistoryPort } from '../ports/CustomerHistoryPort';
import { EvaluateRiskCheckInput } from '../dtos/EvaluateRiskCheckInput';
import { EvaluateRiskCheckOutput } from '../dtos/EvaluateRiskCheckOutput';

export class EvaluateRiskCheck {
  constructor(
    private readonly riskVerification: RiskVerificationPort,
    private readonly customerHistory: CustomerHistoryPort,
    private readonly decisionEngine: RiskDecisionEngine,
  ) {}

  async execute(input: EvaluateRiskCheckInput): Promise<EvaluateRiskCheckOutput> {
    const history = await this.customerHistory.getHistory(input.customerId);

    let verification: RiskVerificationResult | null;

    try {
      verification = await this.riskVerification.verify(input);
    } catch {
      verification = null;
    }

    const decision: Decision = verification
      ? this.decisionEngine.decide({ verification, history })
      : { outcome: 'MANUAL_REVIEW', reasons: ['risk verification unavailable'] };

    await this.customerHistory.recordDecision(input.customerId, decision);

    return {
      customerId: input.customerId,
      decision: decision.outcome,
      reasons: decision.reasons,
      riskScore: verification ? verification.score : null,
    };
  }
}
