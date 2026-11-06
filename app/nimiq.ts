import { validAddress } from './model';
/** Testnet-only checkout. A hash is submission evidence, never settlement evidence. */
export async function requestTestnetContribution(recipient: string, amount: number): Promise<string> {
  if (!validAddress(recipient)) throw new Error('This group needs a valid testnet receiving address.');
  const value = Math.round(amount * 100000);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid contribution amount.');
  const host = window as Window & { nimiqPay?: { network?: string }; nimiq?: { sendBasicTransaction?: (request: { recipient: string; value: number }) => Promise<string> } };
  if (host.nimiqPay) {
    if (host.nimiqPay.network !== 'testnet') throw new Error('Switch Nimiq Pay to testnet before trying a test payment.');
    if (typeof host.nimiq?.sendBasicTransaction !== 'function') throw new Error('The Nimiq Pay payment provider is not ready. Please reopen this screen.');
    return host.nimiq.sendBasicTransaction({ recipient, value });
  }
  const { default: HubApi } = await import('@nimiq/hub-api');
  const hub = new HubApi('https://hub.nimiq-testnet.com');
  const receipt = await hub.checkout({ appName: 'Digital Samiti (testnet)', recipient, value });
  return receipt.hash;
}
