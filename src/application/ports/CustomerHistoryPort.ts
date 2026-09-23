import { CustomerHistory } from '../../domain/value-objects/CustomerHistory';
import { Decision } from '../../domain/value-objects/Decision';

export interface CustomerHistoryPort {
  getHistory(customerId: string): Promise<CustomerHistory>;
  recordDecision(customerId: string, decision: Decision): Promise<void>;
}
