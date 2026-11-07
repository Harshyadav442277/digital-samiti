import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';

if (!process.argv[2]) throw new Error('Provide the path to your Atlas credentials .env file.');
const credentials = parse(await readFile(process.argv[2]));
const uri = new URL(credentials.MONGODB_URI);
if (credentials.MONGODB_USERNAME) uri.username = credentials.MONGODB_USERNAME;
if (credentials.MONGODB_PASSWORD) uri.password = credentials.MONGODB_PASSWORD;
if (!uri.password || /<|>/.test(decodeURIComponent(uri.password))) {
  throw new Error('The Atlas credentials file needs a database password.');
}
let existing = {};
try { existing = parse(await readFile(new URL('../.env', import.meta.url))); } catch {}
const env = {
  MONGODB_URI: uri.toString(),
  MONGODB_DB: existing.MONGODB_DB || 'digital_samiti',
  SAMITI_API_SECRET: existing.SAMITI_API_SECRET || randomBytes(32).toString('hex'),
  CRON_SECRET: existing.CRON_SECRET || randomBytes(32).toString('hex'),
  HOST: '127.0.0.1',
  PORT: '4000',
  COOKIE_SECURE: 'false',
};
await writeFile(new URL('../.env', import.meta.url), Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n');
console.log('Created ignored backend/.env using the supplied Atlas credentials.');
