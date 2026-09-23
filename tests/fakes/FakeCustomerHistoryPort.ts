import { CustomerHistoryPort } from '../../src/application/ports/CustomerHistoryPort';
import { CustomerHistory } from '../../src/domain/value-objects/CustomerHistory';
import { Decision } from '../../src/domain/value-objects/Decision';

export class FakeCustomerHistoryPort implements CustomerHistoryPort {
  public recorded: { customerId: string; decision: Decision }[] = [];

  constructor(private readonly history: CustomerHistory) {}

  async getHistory(_customerId: string): Promise<CustomerHistory> {
    return this.history;
  }

  async recordDecision(customerId: string, decision: Decision): Promise<void> {
    this.recorded.push({ customerId, decision });
  }
}
