import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PublicKey, Signature } from '@nimiq/core';
import { walletAddress, type AppState } from '../app/model';

export const challengeCookie = 'samiti_wallet_challenge';
export const sessionCookie = 'samiti_wallet';
export const challengeSeconds = 300;
export const sessionSeconds = 43200;

export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function walletMessage(origin: string, nonce: string) {
  return `Sign in to Digital Samiti\n${origin}\nChallenge: ${nonce}\nThis signature authorizes sign-in only.`;
}

export function verifyWalletProof(message: string, key: string, proof: string) {
  const publicKey = PublicKey.fromHex(key);
  const signature = Signature.fromHex(proof);
  const bytes = Buffer.from(message, 'utf8');
  const hash = createHash('sha256').update(`\x16Nimiq Signed Message:\n${bytes.length}`).update(bytes).digest();
  if (!publicKey.verify(signature, hash)) return null;
  return publicKey.toAddress().toUserFriendlyAddress().replace(/\s/g, '');
}

function mac(value: string) {
  const secret = process.env.SAMITI_WALLET_SECRET;
  if (!secret || secret.length < 32) throw new Error('Wallet sign-in is not configured.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function seal(kind: string, value: string, seconds: number, origin: string) {
  const payload = `${value}.${Date.now() + seconds * 1000}`;
  return `${payload}.${mac(`${kind}:${origin}:${payload}`)}`;
}

export function openCookie(req: Request, kind: string) {
  const token = req.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(kind + '='))?.slice(kind.length + 1);
  const match = token?.match(/^([a-zA-Z0-9-]{1,80})\.(\d{13})\.([a-f0-9]{64})$/);
  if (!match || Number(match[2]) <= Date.now()) return null;
  const [, value, expiresAt, proof] = match;
  const expected = mac(`${kind}:${new URL(req.url).origin}:${value}.${expiresAt}`);
  return timingSafeEqual(Buffer.from(proof, 'hex'), Buffer.from(expected, 'hex')) ? value : null;
}

export function walletIdentity(req: Request): AppState['user'] | null {
  const id = openCookie(req, sessionCookie);
  const address = id && walletAddress(id);
  if (!address || !id) return null;
  return { id, name: `NQ … ${address.slice(-8)}`, authenticated: true };
}
