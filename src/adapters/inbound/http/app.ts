import express, { Express, Request, Response, NextFunction } from 'express';
import { EvaluateRiskCheck } from '../../../application/use-cases/EvaluateRiskCheck';
import { createRiskCheckRouter } from './riskCheckRouter';

export function createApp(evaluateRiskCheck: EvaluateRiskCheck): Express {
  const app = express();
  app.use(express.json());
  app.use(createRiskCheckRouter(evaluateRiskCheck));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
      res.status(400).json({ error: 'invalid JSON body' });
      return;
    }
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
