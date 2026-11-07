import { forwardToSamitiBackend, usesExpressBackend } from '@/lib/samiti-backend';
import { createGroupSchema } from '../../group-input';
import { database } from '@/lib/database';
import { createHash, randomBytes } from 'node:crypto';
import { getChatGPTUser } from '../../chatgpt-auth';
import { Group, validAddress, round } from '../../model';
import { updateGroup } from '../../domain';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
type Row = { id: string; owner: string; invite: string; visibility: string; data: string; version: number };
async function session(req: Request) {
  const auth = await getChatGPTUser();
  if (auth) return { id: auth.userId, name: auth.fullName || auth.email.split('@')[0], authenticated: true, fresh: false };
  const token = req.headers.get('cookie')?.match(/(?:^|; )samiti_demo=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (token) { const row = await database.prepare('SELECT user_id FROM samiti_guest_sessions WHERE token_hash = ? AND expires_at > now()').bind(createHash('sha256').update(token).digest('hex')).first<{user_id:string}>(); if (row) return { id: row.user_id, name: 'Harsh', authenticated: false, fresh: false, token }; }
  const next = randomBytes(32).toString('hex'); const id = `guest-${crypto.randomUUID()}`;
  await database.prepare("INSERT INTO samiti_guest_sessions (token_hash,user_id,expires_at) VALUES (?,?,now() + interval '30 days')").bind(createHash('sha256').update(next).digest('hex'),id).run();
  return { id, name: 'Harsh', authenticated: false, fresh: true, token: next };
}
function response(data: unknown, s: Awaited<ReturnType<typeof session>>, status = 200) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (s.fresh) headers['Set-Cookie'] = `samiti_demo=${'token' in s ? s.token : ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  return Response.json(data, { status, headers });
}
function db() { return database; }
async function boundedBody(req: Request) {
  if (!req.body) return '';
  const reader = req.body.getReader(); const decoder = new TextDecoder(); let size = 0; let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 12000) { await reader.cancel(); throw new Error('Request is too large.'); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}
async function state(s: Awaited<ReturnType<typeof session>>) {
  const result = await db().prepare("SELECT * FROM samiti_groups WHERE owner = ? OR EXISTS (SELECT 1 FROM json_each(samiti_groups.data, '$.members') AS m WHERE json_extract(m.value, '$.id') = ?) ORDER BY rowid ASC").bind(s.id, s.id).all<Row>();
  const publicResult = await db().prepare("SELECT data FROM samiti_groups WHERE visibility = 'public' LIMIT 100").all<{ data: string }>();
  return { user: { id: s.id, name: s.name, authenticated: s.authenticated }, groups: result.results.map(r => { const g: Group = JSON.parse(r.data); g.autoPay = g.autoPay?.[s.id] ? { [s.id]: g.autoPay[s.id] } : {}; return g; }), publicGroups: publicResult.results.map(r => { const g: Group = JSON.parse(r.data); return { id: g.id, name: g.name, description: g.description, monthly: g.monthly, count: g.members.length, color: g.color, icon: g.icon }; }) };
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
      if (data.wallet && !validAddress(data.wallet)) throw new Error('Enter a valid Nimiq wallet address.');
      if (Math.abs(round(data.monthly) - data.monthly) > 1e-9) throw new Error('Use up to 2 decimal places for contributions.');
      const count = await db().prepare('SELECT COUNT(*) AS n FROM samiti_groups WHERE owner = ?').bind(s.id).first<{ n: number }>();
      if ((count?.n ?? 0) >= 25) throw new Error('You can create up to 25 Samitis.');
      const g: Group = { ...data, id: crypto.randomUUID(), owner: s.id, invite: crypto.randomUUID().replace(/-/g, '').toUpperCase(), demo: true, guestOnly: !s.authenticated, members: [{ id: s.id, name: s.name, saved: 0, interest: 0 }], loans: [], activity: [], created: new Date().toISOString() };
      await insert(g);
    } else if (action === 'join') {
      if (!s.authenticated) return response({ error: 'Sign in to join a Samiti.', signIn: true }, s, 401);
      const code = String(input.code ?? '').trim().toUpperCase();
      let row: Row | null = null;
      if (input.publicId) row = await db().prepare("SELECT * FROM samiti_groups WHERE id = ? AND visibility = 'public'").bind(String(input.publicId)).first<Row>();
      else row = await db().prepare('SELECT * FROM samiti_groups WHERE invite = ?').bind(code).first<Row>();
      if (!row) throw new Error('That invite code was not found. Check it with your group admin.');
      const g: Group = JSON.parse(row.data);
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
      if (!g.members.some(m => m.id === s.id)) return response({ error: 'You are not a member of this Samiti.' }, s, 403);
      const processed = (g as Group & { processed?: string[] }).processed ?? [];
      const requestId = String(input.requestId ?? '');
      if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new Error('Invalid request identifier.');
      if (!processed.includes(requestId)) {
        const updated = updateGroup(g, s.id, action, input) as Group & { processed: string[] };
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
