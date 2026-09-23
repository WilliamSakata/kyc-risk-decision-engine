import { RiskDecisionEngine } from '../../domain/services/RiskDecisionEngine';
import { Decision } from '../../domain/value-objects/Decision';
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

    let decision: Decision;
    let riskScore: number | null;

    try {
      const verification = await this.riskVerification.verify(input);
      decision = this.decisionEngine.decide({ verification, history });
      riskScore = verification.score;
    } catch {
      decision = { outcome: 'MANUAL_REVIEW', reasons: ['risk verification unavailable'] };
      riskScore = null;
    }

    await this.customerHistory.recordDecision(input.customerId, decision);

    return {
      customerId: input.customerId,
      decision: decision.outcome,
      reasons: decision.reasons,
      riskScore,
    };
  }
}
