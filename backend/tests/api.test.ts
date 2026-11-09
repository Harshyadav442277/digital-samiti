import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { KeyPair, Signature, SignatureProof } from '@nimiq/core';
import { MongoClient } from 'mongodb';
import type { Server } from 'node:http';
import { configuration } from '../src/config';
import { SamitiStore } from '../src/store';
import { createApp } from '../src/app';
import { makeDemo } from '../../app/model';

const settings = configuration();
const databaseName = `samiti_test_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const client = new MongoClient(settings.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const store = new SamitiStore(client, databaseName);
let server: Server;
let origin: string;
let cookie: string;
let groupId: string;

async function request(path: string, options: { body?: unknown; cookie?: string; user?: string; token?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {
    authorization: `Bearer ${options.token ?? settings.SAMITI_API_SECRET}`,
    ...options.headers,
  };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.user) {
    headers['x-samiti-user-id'] = options.user;
    headers['x-samiti-user-name'] = 'Test member';
  }
  if (options.body) headers['content-type'] = 'application/json';
  const response = await fetch(origin + path, {
    method: options.body ? 'POST' : 'GET', headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { response, data: await response.json() };
}

function action(name: string, values: Record<string, unknown> = {}) {
  return { action: name, requestId: randomUUID(), ...values };
}

before(async () => {
  await client.connect();
  await store.initialize();
  server = createApp(store, settings).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  // Only this test's generated, uniquely named database may be removed.
  assert.match(databaseName, /^samiti_test_[a-f0-9]{16}$/);
  try { await client.db(databaseName).dropDatabase(); }
  finally { await client.close(); }
});

test('health works and the API rejects missing or spoofed service credentials', async () => {
  assert.equal((await request('/health')).data.database, 'connected');
  const unauthenticated = await request('/api/samiti', { token: 'wrong', headers: { 'x-samiti-user-id': 'owner' } });
  assert.equal(unauthenticated.response.status, 401);
  assert.equal((await request('/api/samiti', { headers: { origin: 'https://evil.example' } })).response.status, 403);
});

test('new sessions and signed-in accounts remain empty after bootstrap', async () => {
  const initial = await request('/api/samiti');
  cookie = initial.response.headers.getSetCookie()[0].split(';')[0];
  assert.match(cookie, /^samiti_demo=[a-f0-9]{64}$/);
  const responses = await Promise.all([1, 2].map(() => request('/api/samiti', { cookie, body: { action: 'bootstrap' } })));
  for (const result of responses) assert.equal(result.response.status, 200, JSON.stringify(result.data));
  const state = await request('/api/samiti', { cookie });
  assert.equal(state.data.groups.length, 0);
  const signedIn = await request('/api/samiti', { user: 'new-account', body: { action: 'bootstrap' } });
  assert.equal(signedIn.data.groups.length, 0);
  const fixtures = makeDemo(state.data.user.id, state.data.user.name);
  // Fixtures belong only to this temporary test database, never to onboarding.
  await store.groups.insertMany(fixtures.map(group => ({ _id: group.id, group, version: 0, createdAt: new Date(group.created) })));
  groupId = fixtures[0].id;
  const session = await store.sessions.findOne({ userId: state.data.user.id });
  assert.notEqual(session?._id, cookie.split('=')[1]);
});

test('simultaneous retries of the same contribution are applied exactly once', async () => {
  const body = action('contribute', { groupId });
  const results = await Promise.all([1, 2, 3].map(() => request('/api/samiti', { cookie, body })));
  results.forEach(result => assert.equal(result.response.status, 200, JSON.stringify(result.data)));
  const state = await request('/api/samiti', { cookie });
  assert.equal(state.data.groups[0].members[0].saved, 7000);
  assert.equal(state.data.groups[0].activity.filter((a: { member: string; type: string }) => a.member === 'Demo member' && a.type === 'contribution').length, 1);
  assert.equal((await request('/api/samiti', { cookie, body: action('contribute', { groupId }) })).response.status, 400);
});

test('anonymous identity headers cannot grant membership', async () => {
  const outsider = await request('/api/samiti', { headers: { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': 'owner@example.invalid' } });
  assert.equal(outsider.data.user.authenticated, false);
  const outsiderCookie = outsider.response.headers.getSetCookie()[0].split(';')[0];
  assert.equal((await request('/api/samiti', { cookie: outsiderCookie, body: action('contribute', { groupId }) })).response.status, 403);
  assert.equal((await request('/api/samiti', { cookie: outsiderCookie, body: action('create') })).response.status, 400);
});

test('votes persist with audit entries and cannot be changed', async () => {
  const state = await request('/api/samiti', { cookie });
  const loanId = state.data.groups[0].loans[0].id;
  const vote = await request('/api/samiti', { cookie, body: action('vote', { groupId, loanId, approve: true }) });
  assert.equal(vote.response.status, 200);
  assert.equal(vote.data.groups[0].loans[0].voteAudit[0].memberId, state.data.user.id);
  assert.equal((await request('/api/samiti', { cookie, body: action('vote', { groupId, loanId, approve: false }) })).response.status, 400);
});

test('all repayment installments close a loan and persistence survives another API instance', async () => {
  const state = await request('/api/samiti', { cookie });
  const group = state.data.groups[1];
  for (let number = 1; number <= 6; number++) {
    const result = await request('/api/samiti', { cookie, body: action('repay', { groupId: group.id, loanId: group.loans[0].id }) });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.groups[1].loans[0].repaid, 515 * number);
  }
  const reopened = new SamitiStore(client, databaseName);
  const reloaded = await reopened.state(state.data.user);
  assert.equal(reloaded.groups[1].loans[0].status, 'repaid');
});

test('authenticated group creation is retry-safe and invitation membership is enforced', async () => {
  const body = action('create', {
    name: 'Integration circle', monthly: 100, target: 1000, rate: 6, months: 6,
    threshold: 60, visibility: 'private', color: 'peach', icon: 'users', rules: '',
  });
  const created = await request('/api/samiti', { user: 'test-owner', body });
  assert.equal(created.response.status, 200, JSON.stringify(created.data));
  const retry = await request('/api/samiti', { user: 'test-owner', body });
  assert.equal(retry.data.groups.length, 1);
  const group = created.data.groups[0];
  const outsider = await request('/api/samiti', { user: 'test-joiner' });
  assert.equal(outsider.data.publicGroups.some((g: { id: string }) => g.id === group.id), false);
  assert.equal((await request('/api/samiti', { user: 'test-joiner', body: action('join', { publicId: group.id }) })).response.status, 404);
  const joined = await request('/api/samiti', { user: 'test-joiner', body: action('join', { code: group.invite }) });
  assert.equal(joined.response.status, 200);
  assert.equal(joined.data.groups[0].members.length, 2);
});

test('Auto Pay settings remain personal and the runner needs its own credential', async () => {
  const state = await request('/api/samiti', { cookie });
  const enabled = await request('/api/samiti', { cookie, body: action('autopay', { groupId, operation: 'enable', day: 28, consent: true }) });
  assert.equal(enabled.response.status, 200);
  assert.equal(Object.keys(enabled.data.groups[0].autoPay).length, 1);
  assert.equal(enabled.data.groups[0].autoPay[state.data.user.id].status, 'active');
  assert.equal((await request('/api/autopay/run')).response.status, 401);
  const run = await request('/api/autopay/run', { headers: { 'x-samiti-cron-authorization': `Bearer ${settings.CRON_SECRET}` } });
  assert.equal(run.response.status, 200);
  assert.equal(run.data.mode, 'demo');
});

test('invalid JSON, oversized requests, and Mongo operator objects are rejected', async () => {
  const headers = { authorization: `Bearer ${settings.SAMITI_API_SECRET}`, 'content-type': 'application/json' };
  const malformed = await fetch(origin + '/api/samiti', { method: 'POST', headers, body: '{' });
  assert.equal(malformed.status, 400);
  const oversized = await request('/api/samiti', { cookie, body: action('contribute', { padding: 'x'.repeat(13000) }) });
  assert.equal(oversized.response.status, 413);
  const injection = await request('/api/samiti', { cookie, body: action('contribute', { groupId: { $ne: null } }) });
  assert.equal(injection.response.status, 400);
});

test('the demo ledger rejects wallet payment hashes', async () => {
  const body = action('create', {
    name: 'Testnet circle', monthly: 100, target: 1000, rate: 6, months: 6,
    threshold: 60, visibility: 'private', color: 'peach', icon: 'users', rules: '',
    wallet: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
  });
  const created = await request('/api/samiti', { user: 'test-receipts', body });
  assert.equal(created.response.status, 200, JSON.stringify(created.data));
  const result = await request('/api/samiti', {
    user: 'test-receipts',
    body: action('payment-submitted', { groupId: created.data.groups[0].id, hash: 'a'.repeat(64) }),
  });
  assert.equal(result.response.status, 400);
  const state = await request('/api/samiti', { user: 'test-receipts' });
  assert.equal(state.data.groups[0].members[0].saved, 0);
});

test('mainnet contributions require the matching finalized transfer from the signed-in wallet', async () => {
  const wallet = KeyPair.generate();
  const user = 'nim-' + wallet.toAddress().toUserFriendlyAddress().replaceAll(' ', '');
  const recipient = KeyPair.generate().toAddress().toUserFriendlyAddress();
  const sender = KeyPair.generate();
  const signed = (key: KeyPair) => SignatureProof.singleSig(
    key.publicKey, Signature.create(key.privateKey, key.publicKey, new Uint8Array([1])),
  ).serialize();
  const proof = Buffer.concat([Buffer.from([1]), signed(sender), signed(wallet)]).toString('hex');
  const hash = 'b'.repeat(64);
  let headBatch = 8;
  let tx: Record<string, unknown>;
  const rpc = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const { method, id } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const head = { network: 'MainAlbatross', timestamp: Date.now(), number: headBatch === 8 ? 250 : 310, batch: headBatch };
    const data = method === 'getLatestBlock' ? head : method === 'getTransactionHashesByAddress' ? []
      : method === 'getTransactionByHash' ? tx
      : { ...head, number: 251, batch: 8, transactions: [tx] };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ jsonrpc: '2.0', id, result: { data } }));
  }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => rpc.once('listening', resolve));
  const listen = rpc.address();
  assert.ok(listen && typeof listen !== 'string');
  const oldRpc = process.env.NIMIQ_MAINNET_RPC_URL;
  process.env.NIMIQ_MAINNET_RPC_URL = 'http://127.0.0.1:' + listen.port;
  try {
    const created = await request('/api/samiti', { user, body: action('create', {
      name: 'Mainnet circle', monthly: 1, target: 100, rate: 0, months: 6,
      threshold: 60, visibility: 'public', color: 'peach', icon: 'users', rules: '', wallet: recipient,
    }) });
    assert.equal(created.response.status, 200, JSON.stringify(created.data));
    const group = created.data.groups[0];
    assert.equal(group.demo, false);
    const unrelated = await request('/api/samiti', { user: 'legacy-user', body: action('join', { code: group.invite }) });
    assert.equal(unrelated.response.status, 403);
    const simulate = await request('/api/samiti', { user, body: action('contribute', { groupId: group.id }) });
    assert.equal(simulate.response.status, 400);
    const prepared = await request('/api/samiti', { user, body: action('mainnet-prepare', { groupId: group.id }) });
    assert.equal(prepared.response.status, 200, JSON.stringify(prepared.data));
    const intent = prepared.data.groups[0].contributionIntents[user];
    const duplicate = await request('/api/samiti', { user, body: action('mainnet-prepare', { groupId: group.id }) });
    assert.equal(duplicate.response.status, 400);
    const check = () => request('/api/samiti', { user, body: action('mainnet-confirm', { groupId: group.id, hash }) });
    const transfer = {
      hash, from: sender.toAddress().toUserFriendlyAddress(), to: recipient, fromType: 2, toType: 0,
      value: 100000, networkId: 24, flags: 0, blockNumber: 251, executionResult: true, proof,
      recipientData: Buffer.from(intent.reference).toString('hex'),
    };
    for (const wrong of [
      { recipientData: '0000' }, { value: 1 }, { networkId: 5 }, { to: wallet.toAddress().toUserFriendlyAddress() },
      { proof: Buffer.concat([Buffer.from([1]), signed(wallet), signed(sender)]).toString('hex') },
    ]) {
      tx = { ...transfer, ...wrong };
      assert.equal((await check()).response.status, 400);
    }
    tx = transfer;
    assert.match((await check()).data.error, /finality/);
    const beforeFinality = await request('/api/samiti', { user });
    assert.equal(beforeFinality.data.groups[0].members[0].saved, 0);
    headBatch = 9;
    const results = await Promise.all([check(), check()]);
    for (const result of results) {
      assert.equal(result.response.status, 200, JSON.stringify(result.data));
      assert.equal(result.data.groups[0].members[0].saved, 1);
      assert.equal(result.data.groups[0].payments.length, 1);
      assert.equal(result.data.groups[0].payments[0].status, 'confirmed');
    }
  } finally {
    await new Promise<void>(resolve => rpc.close(() => resolve()));
    if (oldRpc === undefined) delete process.env.NIMIQ_MAINNET_RPC_URL;
    else process.env.NIMIQ_MAINNET_RPC_URL = oldRpc;
  }
});


test('a fresh demo starts at zero and its private groups remain isolated', async () => {
  const started = await request('/api/samiti', { cookie, body: { action: 'start-demo' } });
  assert.equal(started.response.status, 200);
  assert.equal(started.data.groups.length, 0);
  assert.notEqual(started.data.user.id, (await request('/api/samiti', {cookie})).data.user.id);
  const demoCookie = started.response.headers.getSetCookie()[0].split(';')[0];
  const body = action('create', {
    name: 'My first circle', monthly: 100, target: 1000, rate: 6, months: 6,
    threshold: 60, visibility: 'private', color: 'peach', icon: 'users', rules: '',
  });
  const created = await request('/api/samiti', { cookie: demoCookie, body });
  assert.equal(created.response.status, 200);
  const group = created.data.groups[0];
  assert.equal(group.guestOnly, true);
  assert.equal(group.members[0].saved, 0);
  assert.equal(group.activity.length, 0);
  assert.equal(group.loans.length, 0);
  assert.equal((await request('/api/samiti', { user: 'test-joiner', body: action('join', {code:group.invite}) })).response.status, 403);
  assert.equal((await request('/api/samiti', { cookie: demoCookie, body: {...body,requestId:randomUUID(),visibility:'public'} })).response.status, 403);
  const restarted = await request('/api/samiti', { cookie: demoCookie, body: {action:'start-demo'} });
  assert.equal(restarted.data.groups.length, 0);
  assert.equal((await request('/api/samiti', {cookie:demoCookie})).data.groups.length, 1);
});
