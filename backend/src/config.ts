import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

loadEnv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
// Bundled output lives in dist/, beside src/, so the same relative path works.
const schema = z.object({
  MONGODB_URI: z.string().startsWith('mongodb'),
  MONGODB_DB: z.string().max(38).regex(/^[a-zA-Z0-9_-]+$/).default('digital_samiti'),
  SAMITI_API_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('127.0.0.1'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
});

export function configuration() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Backend configuration required: ${parsed.error.issues.map(issue => issue.path.join('.')).join(', ')}`);
  }
  return parsed.data;
}

export type Configuration = ReturnType<typeof configuration>;
