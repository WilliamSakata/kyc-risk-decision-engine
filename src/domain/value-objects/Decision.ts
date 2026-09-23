export type DecisionOutcome = 'APPROVE' | 'DENY' | 'MANUAL_REVIEW';

export interface Decision {
  outcome: DecisionOutcome;
  reasons: string[];
}
