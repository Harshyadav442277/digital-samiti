import { MongoClient } from 'mongodb';
import { createApp } from './app';
import { configuration } from './config';
import { SamitiStore } from './store';

const settings = configuration();
const client = new MongoClient(settings.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  appName: 'digital-samiti-api',
});

try {
  await client.connect();
  const store = new SamitiStore(client, settings.MONGODB_DB);
  await store.initialize();
  const server = createApp(store, settings).listen(settings.PORT, settings.HOST, () => {
    console.log(`Digital Samiti API listening on http://${settings.HOST}:${settings.PORT}`);
  });
  async function shutdown() {
    server.close(async () => { await client.close(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch (error) {
  console.error('Backend startup failed.', error instanceof Error ? error.name : 'UnknownError');
  await client.close();
  process.exitCode = 1;
}
