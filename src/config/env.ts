export interface AppEnv {
  port: number;
  riskVerificationBaseUrl: string;
}

export function loadEnv(): AppEnv {
  return {
    port: Number(process.env.PORT ?? 3000),
    riskVerificationBaseUrl: process.env.RISK_VERIFICATION_BASE_URL ?? 'http://localhost:4001',
  };
}
