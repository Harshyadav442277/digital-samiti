import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HashedTimeLockedContract } from '@nimiq/core';
import { type Group, monthKey, round, sharedWalletReady, validReceivingWallet, walletAddress } from './model';

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/i).transform(hash => hash.toLowerCase());
const mainnet = z.literal('MainAlbatross');
const block = z.object({
  number: z.number().int().nonnegative(),
  batch: z.number().int().nonnegative(),
  network: mainnet,
  timestamp: z.number().int().positive(),
});
const transfer = z.object({
  hash: hashSchema,
  blockNumber: z.number().int().positive(),
  from: z.string(),
  to: z.string(),
  fromType: z.union([z.literal(0), z.literal(2)]),
  toType: z.literal(0),
  value: z.number().int().positive(),
  networkId: z.literal(24),
  flags: z.literal(0),
  recipientData: z.string(),
  proof: z.string().regex(/^(?:[a-f0-9]{2})+$/i).max(2048),
  executionResult: z.boolean(),
});

async function rpc(method: string, params: unknown[] = []) {
  const endpoint = process.env.NIMIQ_MAINNET_RPC_URL;
  if (!endpoint) throw new Error('Mainnet payments are unavailable until the group ledger can verify Nimiq transactions.');
  try {
    const url = new URL(endpoint);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error();
    const auth = process.env.NIMIQ_MAINNET_RPC_AUTH;
    const res = await fetch(url, {
      method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) throw new Error();
    const body = await res.json();
    if (body.error || !body.result || body.id !== 1) throw new Error();
    return body.result.data as unknown;
  } catch {
    throw new Error(method === 'getTransactionByHash'
      ? 'Transaction is not available on mainnet yet. Check the hash and try verification again.'
      : 'Nimiq mainnet verification is temporarily unavailable. Try again shortly.');
  }
}

async function currentHead() {
  const head = block.safeParse(await rpc('getLatestBlock', [false]));
  if (!head.success || Math.abs(Date.now() - head.data.timestamp) > 300000) {
    throw new Error('The verification node is not synced to Nimiq mainnet.');
  }
  return head.data;
}

const address = (value: string) => value.toUpperCase().replace(/\s/g, '');

export async function changeMainnetContribution(g: Group, userId: string, action: string, input: Record<string, unknown>) {
  const sender = walletAddress(userId);
  const member = g.members.find(m => m.id === userId);
  if (g.demo !== false || !sender || !member) throw new Error('A wallet account in this mainnet Samiti is required.');

  const intent = g.contributionIntents?.[userId];
  if (action === 'mainnet-prepare') {
    const month = monthKey();
    if (!sharedWalletReady(g)) throw new Error('Contributions open after a co-signer confirms the shared wallet.');
    if (input.recipient !== g.wallet) throw new Error('The receiving address changed. Refresh and review it before paying.');
    if (intent) throw new Error('Check the existing payment before starting another.');
    if (member.paidMonth === month) throw new Error('Your contribution is already paid for this month.');
    if (!validReceivingWallet(g.wallet, sender)) {
      throw new Error('The receiving wallet must be a valid address different from your paying wallet.');
    }
    const attempt = z.string().uuid().parse(input.requestId);
    const head = await currentHead();
    // This checks that the configured node can serve transaction history before requesting funds.
    const history = await rpc('getTransactionHashesByAddress', [g.wallet, 1, null]);
    if (!Array.isArray(history)) throw new Error('The verification node cannot read mainnet transaction history.');
    g.contributionIntents ??= {};
    g.contributionIntents[userId] = {
      attempt, reference: 'samiti-' + randomUUID(), month, minBlock: head.number, recipient: g.wallet,
    };
    return;
  }

  if (action === 'mainnet-cancel') {
    if (intent && input.reference === intent.reference) delete g.contributionIntents![userId];
    return;
  }

  const hash = hashSchema.parse(input.hash);
  if (g.payments?.some(p => p.network === 'mainnet' && p.hash === hash && p.memberId === userId)) return;
  if (!intent) throw new Error('There is no open contribution to verify.');
  const recipient = intent.recipient ?? g.wallet;
  const result = transfer.safeParse(await rpc('getTransactionByHash', [hash]));
  const reference = Buffer.from(intent.reference, 'utf8').toString('hex');
  const matches = (tx: z.infer<typeof transfer>) => tx.hash === hash && signedBy(tx, sender)
    && address(tx.to) === address(recipient) && tx.value === Math.round(g.monthly * 100000)
    && tx.recipientData.toLowerCase() === reference && tx.blockNumber >= intent.minBlock;
  if (!result.success || !matches(result.data)) {
    throw new Error('That transaction does not match this contribution. Check your wallet history for the correct hash.');
  }
  const tx = result.data;
  const [head, rawBlock] = await Promise.all([currentHead(), rpc('getBlockByNumber', [tx.blockNumber, true])]);
  const included = block.extend({ transactions: z.array(z.unknown()) }).safeParse(rawBlock);
  if (!included.success || included.data.number !== tx.blockNumber ||
      head.number <= included.data.number || head.batch <= included.data.batch) {
    throw new Error('Waiting for mainnet finality. Check this payment again shortly.');
  }
  const canonical = included.data.transactions.map(item => transfer.safeParse(item))
    .some(item => item.success && matches(item.data) && item.data.executionResult === tx.executionResult && item.data.blockNumber === tx.blockNumber);
  if (!canonical) throw new Error('The transaction was not found in its canonical mainnet block. Check again shortly.');
  delete g.contributionIntents![userId];
  if (!tx.executionResult) return;

  member.saved = round(member.saved + g.monthly);
  if (!member.paidMonth || member.paidMonth < intent.month) member.paidMonth = intent.month;
  const at = new Date(included.data.timestamp).toISOString();
  g.payments ??= [];
  g.payments.unshift({ hash, memberId: userId, amount: g.monthly, recipient, network: 'mainnet', status: 'confirmed', at, month: intent.month });
  g.activity.unshift({ id: hash, member: member.name, label: 'Confirmed Nimiq contribution', amount: g.monthly, at, type: 'contribution' });
}

function signedBy(tx: z.infer<typeof transfer>, sender: string) {
  if (tx.fromType === 0) return address(tx.from) === sender;
  // Nimiq Pay spends from a co-signed HTLC. The authenticated local wallet
  // appears as its creator in the proof carried by the canonical transaction.
  try {
    const proof = HashedTimeLockedContract.proofToPlain(Buffer.from(tx.proof, 'hex'));
    return proof.type === 'early-resolve' && proof.creatorPathLength === 0 && address(proof.creator) === sender;
  } catch {
    return false;
  }
}

export function isMainnetAction(action: string) {
  return ['mainnet-prepare', 'mainnet-confirm', 'mainnet-cancel'].includes(action);
}
