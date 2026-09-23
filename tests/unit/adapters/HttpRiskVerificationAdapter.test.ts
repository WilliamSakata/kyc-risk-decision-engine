import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'node:http';
import { HttpRiskVerificationAdapter } from '../../../src/adapters/outbound/risk-verification/HttpRiskVerificationAdapter';

let server: Server;
let baseUrl: string;
let responseBehavior: 'ok' | 'error' | 'hang' | 'malformed' = 'ok';

beforeAll(async () => {
  server = createServer((req, res) => {
    if (responseBehavior === 'error') {
      res.writeHead(500).end();
      return;
    }
    if (responseBehavior === 'hang') {
      return;
    }
    if (responseBehavior === 'malformed') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ score: 73 }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ score: 73, sanctionsListHit: false }));
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('failed to determine test server address');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
});

const customer = { customerId: 'cus_1', customerName: 'Jane Doe', country: 'BR' };

describe('HttpRiskVerificationAdapter', () => {
  it('returns the parsed verification result on a 200 response', async () => {
    responseBehavior = 'ok';
    const adapter = new HttpRiskVerificationAdapter(baseUrl);

    const result = await adapter.verify(customer);

    expect(result).toEqual({ score: 73, sanctionsListHit: false });
  });

  it('throws when the server responds with a non-2xx status', async () => {
    responseBehavior = 'error';
    const adapter = new HttpRiskVerificationAdapter(baseUrl);

    await expect(adapter.verify(customer)).rejects.toThrow('status 500');
  });

  it('throws when the server does not respond before the timeout', async () => {
    responseBehavior = 'hang';
    const adapter = new HttpRiskVerificationAdapter(baseUrl, 50);

    await expect(adapter.verify(customer)).rejects.toThrow();
  });

  it('throws when the response body is missing sanctionsListHit', async () => {
    responseBehavior = 'malformed';
    const adapter = new HttpRiskVerificationAdapter(baseUrl);

    await expect(adapter.verify(customer)).rejects.toThrow();
  });
});
