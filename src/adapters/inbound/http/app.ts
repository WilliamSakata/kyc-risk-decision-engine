import express, { Express } from 'express';
import { EvaluateRiskCheck } from '../../../application/use-cases/EvaluateRiskCheck';
import { createRiskCheckRouter } from './riskCheckRouter';

export function createApp(evaluateRiskCheck: EvaluateRiskCheck): Express {
  const app = express();
  app.use(express.json());
  app.use(createRiskCheckRouter(evaluateRiskCheck));
  return app;
}
