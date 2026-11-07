import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'dotenv';

const backendPath = new URL('../.env', import.meta.url);
const frontendPath = new URL('../../.env.local', import.meta.url);
const backend = parse(await readFile(backendPath));
const backendUrl = `http://127.0.0.1:${backend.PORT || '4000'}`;
const health = await fetch(backendUrl + '/health', { signal: AbortSignal.timeout(10000) });
const status = await health.json();
if (!health.ok || status.service !== 'digital-samiti-api' || status.database !== 'connected') {
  throw new Error('Start the Express backend and verify Atlas connectivity first.');
}
const existing = await readFile(frontendPath, 'utf8');
const frontend = parse(existing);
if (frontend.CRON_SECRET) backend.CRON_SECRET = frontend.CRON_SECRET;
const kept = existing.split(/\r?\n/).filter(line => !/^SAMITI_API_(URL|SECRET)=/.test(line)).join('\n').trimEnd();
await writeFile(backendPath, Object.entries(backend).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n');
await writeFile(frontendPath, `${kept}\nSAMITI_API_URL=${JSON.stringify(backendUrl)}\nSAMITI_API_SECRET=${JSON.stringify(backend.SAMITI_API_SECRET)}\n`);
console.log('Connected local Next.js API routes to the MongoDB Express backend. Restart both servers to reload configuration.');
