import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { MongoError } from 'mongodb';
import { SamitiStore, ApiError, type Identity } from './store';
import type { Configuration } from './config';

function matchesSecret(value: string | undefined, secret: string) {
  const actual = Buffer.from(value ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const trustedIdentitySchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  name: z.string().min(1).max(200),
});

export function createApp(store: SamitiStore, settings: Configuration) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/health', async (_req, res) => {
    try {
      await store.client.db(store.databaseName).command({ ping: 1, maxTimeMS: 3000 });
      res.json({ status: 'ok', service: 'digital-samiti-api', database: 'connected', mode: 'demo' });
    } catch {
      res.status(503).json({ status: 'unavailable', service: 'digital-samiti-api' });
    }
  });
  app.use((req, _res, next) => {
    if (req.headers.origin) throw new ApiError(403, 'Access this API through the Digital Samiti application.');
    if (!matchesSecret(req.headers.authorization, settings.SAMITI_API_SECRET)) {
      throw new ApiError(401, 'API service authorization required.');
    }
    next();
  });
  app.use(rateLimit({ windowMs: 60000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(express.json({ limit: 12000, strict: true }));

  async function identity(req: Request, res: Response): Promise<Identity> {
    if (req.header('x-samiti-user-id') || req.header('x-samiti-user-name')) {
      let name: string;
      try { name = decodeURIComponent(req.header('x-samiti-user-name') ?? ''); }
      catch { throw new ApiError(400, 'Invalid account name.'); }
      const user = trustedIdentitySchema.parse({ id: req.header('x-samiti-user-id'), name });
      return { ...user, authenticated: true };
    }
    const guest = await store.guest(req.headers.cookie);
    if (guest.token) {
      res.cookie('samiti_demo', guest.token, {
        httpOnly: true, sameSite: 'lax', secure: settings.COOKIE_SECURE === 'true',
        path: '/', maxAge: 30 * 86400000,
      });
    }
    return guest.identity;
  }

  app.get('/api/samiti', async (req, res) => {
    res.json(await store.state(await identity(req, res)));
  });
  app.post('/api/samiti', async (req, res) => {
    res.json(await store.action(await identity(req, res), req.body));
  });
  app.all('/api/autopay/run', async (req, res) => {
    if (!['GET', 'POST'].includes(req.method)) throw new ApiError(405, 'Use GET or POST.');
    if (!matchesSecret(req.header('x-samiti-cron-authorization'), settings.CRON_SECRET)) {
      throw new ApiError(401, 'Scheduler authorization required.');
    }
    res.json(await store.runAutoPay());
  });
  app.use((_req, res) => { res.status(404).json({ error: 'Endpoint not found.' }); });

  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ApiError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request fields.', fields: error.issues.map(issue => issue.path.join('.')) });
      return;
    }
    if (error?.type === 'entity.too.large') { res.status(413).json({ error: 'Request is too large.' }); return; }
    if (error?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Send valid JSON.' }); return; }
    const unavailable = error instanceof MongoError;
    console.error('samiti_api_failed', error instanceof Error ? error.name : 'UnknownError');
    res.status(unavailable ? 503 : 500).json({ error: unavailable ? 'Database unavailable. Please try again.' : 'Unable to complete the request.' });
  };
  app.use(errors);
  return app;
}
