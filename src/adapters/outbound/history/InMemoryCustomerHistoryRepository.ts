import { CustomerHistoryPort } from '../../../application/ports/CustomerHistoryPort';
import { CustomerHistory } from '../../../domain/value-objects/CustomerHistory';
import { Decision } from '../../../domain/value-objects/Decision';

interface StoredRecord {
  wasEverDenied: boolean;
  priorCheckCount: number;
}

export class InMemoryCustomerHistoryRepository implements CustomerHistoryPort {
  private readonly records = new Map<string, StoredRecord>();

  async getHistory(customerId: string): Promise<CustomerHistory> {
    const record = this.records.get(customerId);
    if (!record) {
      return { wasEverDenied: false, priorCheckCount: 0 };
    }
    return { ...record };
  }

  async recordDecision(customerId: string, decision: Decision): Promise<void> {
    const existing = this.records.get(customerId) ?? { wasEverDenied: false, priorCheckCount: 0 };
    this.records.set(customerId, {
      priorCheckCount: existing.priorCheckCount + 1,
      wasEverDenied: existing.wasEverDenied || decision.outcome === 'DENY',
    });
  }
}
