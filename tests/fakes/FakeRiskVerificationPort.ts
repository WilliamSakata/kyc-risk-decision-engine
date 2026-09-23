import { RiskVerificationPort, RiskVerificationSubject } from '../../src/application/ports/RiskVerificationPort';
import { RiskVerificationResult } from '../../src/domain/value-objects/RiskVerificationResult';

export class FakeRiskVerificationPort implements RiskVerificationPort {
  constructor(private readonly result: RiskVerificationResult | Error) {}

  async verify(_customer: RiskVerificationSubject): Promise<RiskVerificationResult> {
    if (this.result instanceof Error) {
      throw this.result;
    }
    return this.result;
  }
}
