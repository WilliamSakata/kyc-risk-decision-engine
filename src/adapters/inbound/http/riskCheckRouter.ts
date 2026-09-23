import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { EvaluateRiskCheck } from '../../../application/use-cases/EvaluateRiskCheck';

const riskCheckRequestSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  country: z.string().length(2),
});

export function createRiskCheckRouter(evaluateRiskCheck: EvaluateRiskCheck): Router {
  const router = Router();

  router.post('/risk-checks', async (req: Request, res: Response) => {
    const parseResult = riskCheckRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ error: 'invalid request body', details: parseResult.error.flatten() });
      return;
    }

    const result = await evaluateRiskCheck.execute(parseResult.data);
    res.status(200).json(result);
  });

  return router;
}
