import express from 'express';
import { MongoClient } from 'mongodb';
import { configuration } from './config';
import { createApp } from './app';
import { SamitiStore } from './store';

const settings = configuration();
const client = new MongoClient(settings.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  appName: 'digital-samiti-api-vercel',
});
const store = new SamitiStore(client, settings.MONGODB_DB);
let ready: Promise<void> | undefined;
const app = express();
app.disable('x-powered-by');

// Each warm function reuses its connection pool. A failed cold start may retry.
app.use(async (_req, res, next) => {
  ready ??= client.connect().then(() => store.initialize());
  try {
    await ready;
    next();
  } catch (error) {
    ready = undefined;
    const failure = error as { name?: string; reason?: { servers?: Map<string, { error?: { name?: string; cause?: { code?: string; message?: string } } }> } };
    console.error('samiti_backend_initialization_failed', {
      type: failure.name ?? 'UnknownError',
      connections: [...(failure.reason?.servers?.values() ?? [])].map(server => ({
        type: server.error?.name, code: server.error?.cause?.code,
        detail: server.error?.cause?.message,
      })),
    });
    res.status(503).set('Cache-Control', 'no-store').json({ error: 'Database unavailable. Please try again.' });
  }
});
app.use(createApp(store, settings));
export default app;
