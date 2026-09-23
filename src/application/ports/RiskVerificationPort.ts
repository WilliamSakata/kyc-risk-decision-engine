import { RiskVerificationResult } from '../../domain/value-objects/RiskVerificationResult';

export interface RiskVerificationSubject {
  customerId: string;
  customerName: string;
  country: string;
}

export interface RiskVerificationPort {
  verify(customer: RiskVerificationSubject): Promise<RiskVerificationResult>;
}
