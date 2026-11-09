import { forwardToSamitiBackend, usesExpressBackend } from '@/lib/samiti-backend';
import { createGroupSchema } from '../../group-input';
import { database } from '@/lib/database';
import { createHash, randomBytes } from 'node:crypto';
import { walletIdentity } from '@/lib/wallet-auth';
import { boundedBody } from '@/lib/bounded-body';
import { changeMainnetContribution, isMainnetAction } from '../../mainnet-contribution';
import { Group, validReceivingWallet, round, groupInWorkspace, walletAddress } from '../../model';
import { updateGroup } from '../../domain';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
type Row = { id: string; owner: string; invite: string; visibility: string; data: string; version: number };
async function session(req: Request) {
  const auth = walletIdentity(req);
  if (auth) return { ...auth, fresh: false };
  const token = req.headers.get('cookie')?.match(/(?:^|; )samiti_demo=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (token) { const row = await database.prepare('SELECT user_id FROM samiti_guest_sessions WHERE token_hash = ? AND expires_at > now()').bind(createHash('sha256').update(token).digest('hex')).first<{user_id:string}>(); if (row) return { id: row.user_id, name: 'Demo member', authenticated: false, fresh: false, token }; }
  const next = randomBytes(32).toString('hex'); const id = `guest-${crypto.randomUUID()}`;
  await database.prepare("INSERT INTO samiti_guest_sessions (token_hash,user_id,expires_at) VALUES (?,?,now() + interval '30 days')").bind(createHash('sha256').update(next).digest('hex'),id).run();
  return { id, name: 'Demo member', authenticated: false, fresh: true, token: next };
}
function response(data: unknown, s: Awaited<ReturnType<typeof session>>, status = 200) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (s.fresh) headers['Set-Cookie'] = `samiti_demo=${'token' in s ? s.token : ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  return Response.json(data, { status, headers });
}
function db() { return database; }
async function state(s: Awaited<ReturnType<typeof session>>) {
  const result = await db().prepare("SELECT * FROM samiti_groups WHERE owner = ? OR EXISTS (SELECT 1 FROM json_each(samiti_groups.data, '$.members') AS m WHERE json_extract(m.value, '$.id') = ?) ORDER BY rowid ASC").bind(s.id, s.id).all<Row>();
  const real = Boolean(walletAddress(s.id));
  const publicResult = s.authenticated
    ? await db().prepare("SELECT data FROM samiti_groups WHERE visibility = 'public' AND COALESCE(data::jsonb->>'demo', 'true') = ? LIMIT 100").bind(String(!real)).all<{ data: string }>()
    : { results: [] };
  const groups = result.results.map(r => JSON.parse(r.data) as Group).filter(g => groupInWorkspace(g, s.id));
  for (const g of groups) {
    g.autoPay = g.autoPay?.[s.id] ? { [s.id]: g.autoPay[s.id] } : {};
    g.contributionIntents = g.contributionIntents?.[s.id] ? { [s.id]: g.contributionIntents[s.id] } : {};
  }
  return { user: { id: s.id, name: s.name, authenticated: s.authenticated }, groups,
    publicGroups: publicResult.results.map(r => {
      const g: Group = JSON.parse(r.data);
      return { id: g.id, name: g.name, description: g.description, monthly: g.monthly, count: g.members.length, color: g.color, icon: g.icon };
    }),
  };
}
async function insert(g: Group) { await db().prepare('INSERT OR IGNORE INTO samiti_groups (id, owner, invite, visibility, data, version) VALUES (?, ?, ?, ?, ?, 0)').bind(g.id, g.owner, g.invite, g.visibility, JSON.stringify(g)).run(); }
export async function GET(req: Request) {
  if (usesExpressBackend()) return forwardToSamitiBackend(req);
  const s = await session(req);
  try { return response(await state(s), s); } catch (e) { console.error('samiti_state_failed', e); return response({ error: 'Unable to load your Samitis. Please try again.' }, s, 503); }
}
export async function POST(req: Request) {
  if (usesExpressBackend()) return forwardToSamitiBackend(req);
  const s = await session(req);
  if (req.headers.get('origin') !== new URL(req.url).origin) return response({ error: 'Please send requests from Digital Samiti.' }, s, 403);
  if (Number(req.headers.get('content-length')) > 12000) return response({ error: 'Request is too large.' }, s, 413);
  try {
    const text = await boundedBody(req);
    const input = JSON.parse(text); const action = String(input.action);
    if (action === 'start-demo') {
      if (s.authenticated) return response({ error: 'Sign out before opening a guest demo.' }, s, 403);
      const fresh = await session(new Request(req.url));
      return response(await state(fresh), fresh);
    } else if (action === 'bootstrap') {
      // Kept for older clients. Empty accounts receive no generated balances.
    } else if (action === 'create') {
      const data = createGroupSchema.parse(input);
      if (!s.authenticated && data.visibility !== 'private') return response({ error: 'Demo circles are personal and private.' }, s, 403);
      const sender = walletAddress(s.id);
      const demo = !sender;
      if (sender && !validReceivingWallet(data.wallet, sender)) throw new Error('Enter a valid receiving address separate from your Nimiq Pay wallet.');
      if (demo) data.wallet = '';
      if (round(data.monthly) !== data.monthly) throw new Error('Use up to 2 decimal places for contributions.');
      const count = await db().prepare('SELECT COUNT(*) AS n FROM samiti_groups WHERE owner = ?').bind(s.id).first<{ n: number }>();
      if ((count?.n ?? 0) >= 25) throw new Error('You can create up to 25 Samitis.');
      const g: Group = { ...data, id: crypto.randomUUID(), owner: s.id, invite: crypto.randomUUID().replace(/-/g, '').toUpperCase(), demo, guestOnly: !s.authenticated, members: [{ id: s.id, name: s.name, saved: 0, interest: 0 }], loans: [], activity: [], created: new Date().toISOString() };
      await insert(g);
    } else if (action === 'join') {
      if (!s.authenticated) return response({ error: 'Sign in to join a Samiti.', signIn: true }, s, 401);
      const code = String(input.code ?? '').trim().toUpperCase();
      let row: Row | null = null;
      if (input.publicId) row = await db().prepare("SELECT * FROM samiti_groups WHERE id = ? AND visibility = 'public'").bind(String(input.publicId)).first<Row>();
      else row = await db().prepare('SELECT * FROM samiti_groups WHERE invite = ?').bind(code).first<Row>();
      if (!row) throw new Error('That invite code was not found. Check it with your group admin.');
      const g: Group = JSON.parse(row.data);
      if (!groupInWorkspace(g, s.id)) return response({ error: 'This Samiti belongs to a different workspace.' }, s, 403);
      if (g.guestOnly) return response({ error: 'This circle belongs to a personal demo.' }, s, 403);
      if (!g.members.some(m => m.id === s.id)) {
        if (g.members.length >= 100) throw new Error('This Samiti has reached its 100-member limit.');
        g.members.push({ id: s.id, name: s.name, saved: 0, interest: 0 });
        g.activity.unshift({ id: crypto.randomUUID(), member: s.name, label: 'Joined the Samiti', amount: 0, type: 'joined', at: new Date().toISOString() });
        await save(g, row.version);
      }
    } else {
      const row = await db().prepare('SELECT * FROM samiti_groups WHERE id = ?').bind(String(input.groupId ?? '')).first<Row>();
      if (!row) throw new Error('Samiti not found.');
      const g: Group = JSON.parse(row.data);
      if (!groupInWorkspace(g, s.id) || !g.members.some(m => m.id === s.id)) return response({ error: 'You are not a member of this Samiti.' }, s, 403);
      const processed = (g as Group & { processed?: string[] }).processed ?? [];
      const requestId = String(input.requestId ?? '');
      if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new Error('Invalid request identifier.');
      if (!processed.includes(requestId)) {
        if (isMainnetAction(action)) await changeMainnetContribution(g, s.id, action, input);
        else updateGroup(g, s.id, action, input);
        const updated = g as Group & { processed: string[] };
        updated.processed = [...processed.slice(-999), requestId];
        if (updated.activity.length > 1000) updated.activity = updated.activity.slice(0, 1000);
        await save(updated, row.version);
      }
    }
    return response(await state(s), s);
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : e instanceof Error ? e.message : 'Please try again.';
    return response({ error: message }, s, 400);
  }
}
async function save(g: Group, version: number) {
  const result = await db().prepare('UPDATE samiti_groups SET data = ?, version = version + 1 WHERE id = ? AND version = ?').bind(JSON.stringify(g), g.id, version).run();
  if (result.meta.changes !== 1) throw new Error('Another member just updated this Samiti. Refresh and try again.');
}
