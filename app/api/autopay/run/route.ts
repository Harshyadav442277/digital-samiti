import { forwardToSamitiBackend, usesExpressBackend } from '@/lib/samiti-backend';
import { timingSafeEqual } from 'node:crypto';
import { database } from '@/lib/database';
import { runAutoPayBatch, autoPaySummary } from '../../../autopay-store';
export const dynamic = 'force-dynamic';
function authorized(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get('origin')) return false;
  const actual = Buffer.from(req.headers.get('authorization') ?? ''); const wanted = Buffer.from(`Bearer ${expected}`);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Scheduler authorization required.' }, { status: 401 });
  if (usesExpressBackend()) return forwardToSamitiBackend(req, true);
  return Response.json({ ...await runAutoPayBatch(database), persisted: await autoPaySummary(database) }, { headers: { 'Cache-Control': 'no-store' } });
}
export const POST = GET;
