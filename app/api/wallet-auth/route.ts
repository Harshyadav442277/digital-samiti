import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/database';
import { forwardToSamitiBackend, usesExpressBackend } from '@/lib/samiti-backend';
import { challengeCookie, challengeSeconds, digest, openCookie, seal, sessionCookie, sessionSeconds, verifyWalletProof, walletMessage } from '@/lib/wallet-auth';
import { boundedBody } from '@/lib/bounded-body';
import { validAddress } from '@/app/model';

const proof = z.object({
  action: z.literal('verify'),
  publicKey: z.string().regex(/^[a-f0-9]{64}$/i),
  signature: z.string().regex(/^[a-f0-9]{128}$/i),
  accounts: z.array(z.string().max(60)).min(1).max(50),
});
const requestSchema = z.discriminatedUnion('action', [proof, z.object({ action: z.enum(['challenge', 'sign-out']) })]);

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function cookie(res: NextResponse, name: string, value: string, maxAge: number) {
  res.cookies.set(name, value, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge });
}

async function consume(req: Request, nonce: string) {
  if (usesExpressBackend()) {
    const upstream = await forwardToSamitiBackend(new Request(req.url, {
      method: 'POST', headers: { origin: new URL(req.url).origin }, body: JSON.stringify({ nonce }),
    }), 'wallet-challenge');
    if (upstream.status === 409) return false;
    if (!upstream.ok) throw new Error('Wallet sign-in is temporarily unavailable.');
    return true;
  }
  const db = sql();
  const [, claimed] = await db.transaction([
    db`DELETE FROM samiti_wallet_challenges WHERE expires_at <= now()`,
    db`INSERT INTO samiti_wallet_challenges (nonce_hash, expires_at)
       VALUES (${nonce}, now() + interval '5 minutes') ON CONFLICT DO NOTHING RETURNING nonce_hash`,
  ]);
  return claimed.length === 1;
}

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  if (req.headers.get('origin') !== origin) return response({ error: 'Open Digital Samiti to sign in.' }, 403);
  let input: z.infer<typeof requestSchema>;
  try { input = requestSchema.parse(JSON.parse(await boundedBody(req))); }
  catch { return response({ error: 'Invalid wallet sign-in request.' }, 400); }
  try {
    if (input.action === 'sign-out') {
      const res = response({ ok: true });
      cookie(res, sessionCookie, '', 0);
      cookie(res, challengeCookie, '', 0);
      return res;
    }
    if (input.action === 'challenge') {
      const nonce = randomBytes(32).toString('hex');
      const res = response({ message: walletMessage(origin, digest(nonce)) });
      cookie(res, challengeCookie, seal(challengeCookie, nonce, challengeSeconds, origin), challengeSeconds);
      return res;
    }
    const nonce = openCookie(req, challengeCookie);
    if (!nonce) return response({ error: 'Your sign-in request expired. Start again in Nimiq Pay.' }, 401);
    if (input.action !== 'verify') return response({ error: 'Invalid wallet sign-in request.' }, 400);
    let address: string | null;
    try { address = verifyWalletProof(walletMessage(origin, digest(nonce)), input.publicKey, input.signature); }
    catch { address = null; }
    if (!address || !input.accounts.some(account => validAddress(account) && account.toUpperCase().replace(/\s/g, '') === address)) {
      return response({ error: 'The signature does not match a connected Nimiq wallet.' }, 401);
    }
    if (!await consume(req, digest(nonce))) return response({ error: 'This sign-in request was already used. Start again.' }, 409);
    const res = response({ ok: true });
    cookie(res, challengeCookie, '', 0);
    cookie(res, sessionCookie, seal(sessionCookie, 'nim-' + address, sessionSeconds, origin), sessionSeconds);
    return res;
  } catch (failure) {
    console.error('wallet_sign_in_failed', failure instanceof Error ? failure.name : 'UnknownError');
    return response({ error: 'Wallet sign-in is temporarily unavailable.' }, 503);
  }
}
