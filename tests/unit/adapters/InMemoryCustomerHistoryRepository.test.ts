import { describe, it, expect } from 'vitest';
import { InMemoryCustomerHistoryRepository } from '../../../src/adapters/outbound/history/InMemoryCustomerHistoryRepository';

describe('InMemoryCustomerHistoryRepository', () => {
  it('returns a blank history for a customer with no records', async () => {
    const repo = new InMemoryCustomerHistoryRepository();

    const history = await repo.getHistory('cus_new');

    expect(history).toEqual({ wasEverDenied: false, priorCheckCount: 0 });
  });

  it('marks wasEverDenied after a DENY decision is recorded', async () => {
    const repo = new InMemoryCustomerHistoryRepository();

    await repo.recordDecision('cus_1', { outcome: 'DENY', reasons: ['x'] });
    const history = await repo.getHistory('cus_1');

    expect(history).toEqual({ wasEverDenied: true, priorCheckCount: 1 });
  });

  it('keeps wasEverDenied true even after a later APPROVE', async () => {
    const repo = new InMemoryCustomerHistoryRepository();

    await repo.recordDecision('cus_1', { outcome: 'DENY', reasons: ['x'] });
    await repo.recordDecision('cus_1', { outcome: 'APPROVE', reasons: [] });
    const history = await repo.getHistory('cus_1');

    expect(history).toEqual({ wasEverDenied: true, priorCheckCount: 2 });
  });

  it('keeps separate history per customer', async () => {
    const repo = new InMemoryCustomerHistoryRepository();

    await repo.recordDecision('cus_1', { outcome: 'DENY', reasons: ['x'] });
    const history = await repo.getHistory('cus_2');

    expect(history).toEqual({ wasEverDenied: false, priorCheckCount: 0 });
  });
});
