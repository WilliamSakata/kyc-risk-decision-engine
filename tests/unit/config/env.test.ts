import { describe, it, expect, afterEach } from 'vitest';
import { loadEnv } from '../../../src/config/env';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('loadEnv', () => {
  it('defaults port to 3000 and base url to localhost:4001 when unset', () => {
    delete process.env.PORT;
    delete process.env.RISK_VERIFICATION_BASE_URL;

    const env = loadEnv();

    expect(env.port).toBe(3000);
    expect(env.riskVerificationBaseUrl).toBe('http://localhost:4001');
  });

  it('reads PORT and RISK_VERIFICATION_BASE_URL from the environment when set', () => {
    process.env.PORT = '5050';
    process.env.RISK_VERIFICATION_BASE_URL = 'http://risk-mock:9000';

    const env = loadEnv();

    expect(env.port).toBe(5050);
    expect(env.riskVerificationBaseUrl).toBe('http://risk-mock:9000');
  });
});
