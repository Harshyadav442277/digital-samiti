import './check-journeys.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { KeyPair, Signature } from '@nimiq/core';
const origin = process.argv[2] || 'http://localhost:3017';
assert.equal((await fetch(origin+'/api/autopay/run')).status,401);
assert.equal((await fetch(origin+'/api/auth/get-session')).status,404);

const auth = (body, cookie = '', requestOrigin = origin) => fetch(origin + '/api/wallet-auth', {
  method: 'POST', headers: { Cookie: cookie, Origin: requestOrigin, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
assert.equal((await auth({ action: 'challenge' }, '', 'https://example.com')).status, 403);
const challenge = await auth({ action: 'challenge' });
assert.equal(challenge.status, 200);
const challengeCookie = challenge.headers.getSetCookie()[0].split(';')[0];
const { message } = await challenge.json();
assert.ok(message.includes(origin));
const key = KeyPair.generate();
const address = key.toAddress().toUserFriendlyAddress();
const hash = createHash('sha256').update('\x16Nimiq Signed Message:\n' + Buffer.byteLength(message)).update(message).digest();
const signature = Signature.create(key.privateKey, key.publicKey, hash).toHex();
const proof = { action: 'verify', accounts: [address], publicKey: key.publicKey.toHex(), signature };
assert.equal((await auth({ ...proof, signature: '00'.repeat(64) }, challengeCookie)).status, 401);
const attempts = await Promise.all([auth(proof, challengeCookie), auth(proof, challengeCookie)]);
assert.deepEqual(attempts.map(res => res.status).sort(), [200, 409]);
const success = attempts.find(res => res.ok);
const session = success.headers.getSetCookie().find(cookie => cookie.startsWith('samiti_wallet=')).split(';')[0];
const state = async (cookie, headers = {}) => (await fetch(origin + '/api/samiti', { headers: { Cookie: cookie, ...headers } })).json();
const walletState = await state(session);
assert.equal(walletState.user.id, 'nim-' + address.replaceAll(' ', ''));
assert.equal(walletState.user.authenticated, true);
assert.deepEqual(walletState.groups, []);
const forged = await state(session.slice(0, -1) + (session.endsWith('a') ? 'b' : 'a'), { 'x-samiti-user-id': walletState.user.id });
assert.equal(forged.user.authenticated, false);
assert.equal((await auth({ action: 'sign-out' }, session)).headers.getSetCookie().some(cookie => cookie.startsWith('samiti_wallet=;')), true);
console.log('PASS: protected scheduler, wallet proof and session, origin protection, challenge replay, forged identity, and sign-out cookie.');
