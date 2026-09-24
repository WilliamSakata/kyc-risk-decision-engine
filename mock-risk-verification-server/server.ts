import express, { Express } from 'express';

function scoreForCustomer(customerId: string): number {
  let hash = 0;
  for (let i = 0; i < customerId.length; i += 1) {
    hash = (hash * 31 + customerId.charCodeAt(i)) % 100;
  }
  return hash;
}

export function createMockRiskVerificationApp(): Express {
  const app = express();
  app.use(express.json());

  app.post('/verifications', (req, res) => {
    const { customerId } = req.body as { customerId?: string };

    if (!customerId) {
      res.status(400).json({ error: 'customerId is required' });
      return;
    }

    res.status(200).json({
      score: scoreForCustomer(customerId),
      sanctionsListHit: customerId === 'cus_sanctioned',
    });
  });

  return app;
}

if (require.main === module) {
  const app = createMockRiskVerificationApp();
  const port = Number(process.env.PORT ?? 4001);
  app.listen(port, () => {
    console.log(`mock-risk-verification-server listening on port ${port}`);
  });
}
