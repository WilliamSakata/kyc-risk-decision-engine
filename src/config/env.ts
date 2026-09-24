export interface AppEnv {
  port: number;
  riskVerificationBaseUrl: string;
}

export function loadEnv(): AppEnv {
  const rawPort = process.env.PORT;
  const port = rawPort === undefined ? 3000 : Number(rawPort);

  if (Number.isNaN(port)) {
    throw new Error(`Invalid PORT environment variable: "${rawPort}" is not a number`);
  }

  return {
    port,
    riskVerificationBaseUrl: process.env.RISK_VERIFICATION_BASE_URL ?? 'http://localhost:4001',
  };
}
