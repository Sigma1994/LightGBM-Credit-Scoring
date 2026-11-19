import 'dotenv/config';
import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import type { Decision } from './src/shared/types.ts';
import { CreditScoringService } from './server/scoringEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const scoringService = new CreditScoringService();
  await scoringService.init();

  app.use(express.json({ limit: '64kb' }));

  // Correlation ID middleware for sanitized server error reporting
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.header('x-request-id') || crypto.randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  // 1. Liveness probe (process alive)
  app.get('/api/health/live', (_req: Request, res: Response) => {
    res.json({ status: 'ALIVE', timestamp: new Date().toISOString() });
  });

  // 2. Readiness probe (fails closed 503 if model, contract, or audit channel degraded)
  app.get('/api/health/ready', (_req: Request, res: Response) => {
    const readiness = scoringService.getReadiness();
    const httpStatus = readiness.status === 'READY' ? 200 : 503;
    res.status(httpStatus).json(readiness);
  });

  // 3. Customer directory & ledger inspection
  app.get('/api/customers', async (_req: Request, res: Response) => {
    try {
      const customers = await scoringService.listCustomers();
      res.json({ customers });
    } catch (err) {
      console.error(`[${res.locals.requestId}] Customer list error:`, (err as Error).message);
      res.status(500).json({ error: 'Unable to fetch customer directory.', correlation_id: res.locals.requestId });
    }
  });

  app.get('/api/customers/:customerId/ledger', async (req: Request, res: Response) => {
    const customerId = String(req.params.customerId || '').trim();
    if (!/^CUST-\d{4}$/.test(customerId)) {
      res.status(400).json({ error: 'Invalid customer_id format. Expected CUST-XXXX.' });
      return;
    }
    try {
      const events = await scoringService.getCustomerEvents(customerId);
      if (events.length === 0) {
        res.status(404).json({ error: 'Customer not found in immutable ledger.' });
        return;
      }
      res.json({ customer_id: customerId, events });
    } catch (err) {
      console.error(`[${res.locals.requestId}] Ledger fetch error:`, (err as Error).message);
      res.status(500).json({ error: 'Unable to fetch customer ledger.', correlation_id: res.locals.requestId });
    }
  });

  // 4. Contract-enforced Point-in-Time scoring endpoint
  app.post('/api/score-customer', async (req: Request, res: Response) => {
    const { customer_id, as_of_time, include_leakage_audit } = req.body ?? {};

    if (typeof customer_id !== 'string' || !/^CUST-\d{4}$/.test(customer_id.trim())) {
      res.status(400).json({
        error: 'Validation failed: customer_id must match CUST-XXXX.',
        correlation_id: res.locals.requestId,
      });
      return;
    }

    if (typeof as_of_time !== 'string' || !as_of_time.trim()) {
      res.status(400).json({
        error: 'Validation failed: as_of_time must be a valid ISO-8601 UTC string.',
        correlation_id: res.locals.requestId,
      });
      return;
    }

    try {
      const result = await scoringService.scoreCustomer(
        customer_id.trim(),
        as_of_time.trim(),
        include_leakage_audit !== false
      );
      res.json(result);
    } catch (err) {
      const error = err as Error & { statusCode?: number };
      const status = error.statusCode ?? 400;
      console.error(`[${res.locals.requestId}] Scoring error:`, error.message);
      res.status(status).json({
        error: error.message,
        correlation_id: res.locals.requestId,
      });
    }
  });

  // 5. Bounded Telemetry & Audit Logs
  app.get('/api/telemetry', async (req: Request, res: Response) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const decisionParam = typeof req.query.decision === 'string' ? req.query.decision : undefined;
    const validDecisions: Decision[] = ['APPROVE', 'MANUAL_REVIEW', 'DECLINE'];
    const decisionFilter = validDecisions.includes(decisionParam as Decision)
      ? (decisionParam as Decision)
      : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

    try {
      res.json(await scoringService.getTelemetry(limit, decisionFilter, search));
    } catch (err) {
      console.error(`[${res.locals.requestId}] Telemetry error:`, (err as Error).message);
      res.status(500).json({ error: 'Unable to fetch telemetry logs.', correlation_id: res.locals.requestId });
    }
  });

  // 6. Real PSI Drift Report
  app.get('/api/drift', async (_req: Request, res: Response) => {
    try {
      res.json(await scoringService.computeDriftReport());
    } catch (err) {
      console.error(`[${res.locals.requestId}] Drift computation error:`, (err as Error).message);
      res.status(500).json({ error: 'Unable to compute PSI drift.', correlation_id: res.locals.requestId });
    }
  });

  // 7. Feature Contract & Dynamic Thresholds
  app.get('/api/contract', (_req: Request, res: Response) => {
    res.json(scoringService.getContract());
  });

  app.patch('/api/contract/thresholds', (req: Request, res: Response) => {
    const { approve_max_prob, manual_review_max_prob } = req.body ?? {};
    try {
      const updated = scoringService.updateThresholds(
        Number(approve_max_prob),
        Number(manual_review_max_prob)
      );
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // 8. Operational Fault-Injection & Traffic Simulation
  app.post('/api/ops/fault-injection', (req: Request, res: Response) => {
    const { model_loaded, audit_channel_healthy } = req.body ?? {};
    const state = scoringService.setFaultInjection({ model_loaded, audit_channel_healthy });
    res.json(state);
  });

  app.post('/api/telemetry/batch-seed', async (req: Request, res: Response) => {
    const count = Math.min(50, Math.max(1, Number(req.body?.count) || 12));
    const shiftRisk = Boolean(req.body?.shift_risk);
    try {
      const created = await scoringService.simulateBatchTraffic(count, shiftRisk);
      res.json({ created, drift: await scoringService.computeDriftReport() });
    } catch (err) {
      const error = err as Error & { statusCode?: number };
      res.status(error.statusCode ?? 503).json({ error: error.message });
    }
  });

  // Mount Vite middleware in dev or serve built assets in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    const ready = scoringService.getReadiness();
    console.log(
      `AegisCredit Risk Console running on http://localhost:${port} (storage: ${ready.storage_backend})`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
