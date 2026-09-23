import { z } from 'zod';
import { RiskVerificationPort, RiskVerificationSubject } from '../../../application/ports/RiskVerificationPort';
import { RiskVerificationResult } from '../../../domain/value-objects/RiskVerificationResult';

const riskVerificationResponseSchema = z.object({
  score: z.number().min(0).max(100),
  sanctionsListHit: z.boolean(),
});

export class HttpRiskVerificationAdapter implements RiskVerificationPort {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number = 2000,
  ) {}

  async verify(customer: RiskVerificationSubject): Promise<RiskVerificationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/verifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`risk verification service responded with status ${response.status}`);
      }

      const body = riskVerificationResponseSchema.parse(await response.json());
      return { score: body.score, sanctionsListHit: body.sanctionsListHit };
    } finally {
      clearTimeout(timeout);
    }
  }
}
