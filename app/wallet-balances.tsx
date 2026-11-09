'use client';

import { useEffect, useState } from 'react';
import { type init } from '@nimiq/mini-app-sdk';
import { validAddress } from './model';
import { mainnetProvider } from './wallet-sign-in';

const formatNim = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 5 });
type Balances = { spendable: number | null; address: number | null };

export function WalletBalances({ wallet, hidden }: { wallet: string; hidden: boolean }) {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    let version = 0;
    let reading = false;
    let provider: Awaited<ReturnType<typeof init>> | undefined;
    let accounts: string[] | undefined;

    async function refresh(updatedAccounts?: string[]) {
      if (!provider || disposed || (reading && !updatedAccounts)) return;
      const current = provider;
      const request = ++version;
      reading = true;
      try {
        const shared = updatedAccounts ?? await current.listAccounts();
        if (disposed || request !== version) return;
        const [personal, paymentContract] = shared;
        if (!personal || personal.toUpperCase().replace(/\s/g, '') !== wallet) {
          throw new Error('The active Nimiq Pay wallet differs from this session. Sign in again to see its balance.');
        }
        if (paymentContract && !validAddress(paymentContract)) throw new Error('Could not read your Nimiq Pay payment address.');
        accounts = shared;
        const read = async (address: string) => {
          const luna = await current.getBalance(address);
          return Number.isSafeInteger(luna) && luna >= 0 ? luna : null;
        };
        const [spendable, address] = await Promise.allSettled([
          paymentContract ? read(paymentContract) : Promise.resolve(0),
          read(personal),
        ]);
        if (disposed || request !== version) return;
        setBalances({
          spendable: spendable.status === 'fulfilled' ? spendable.value : null,
          address: address.status === 'fulfilled' ? address.value : null,
        });
        setError('');
      } catch (failure) {
        if (disposed || request !== version) return;
        accounts = undefined;
        setBalances(null);
        setError(failure instanceof Error ? failure.message : 'Unable to read your NIM balance.');
      } finally {
        if (request === version) reading = false;
      }
    }

    function onFocus() {
      if (accounts && document.visibilityState === 'visible') void refresh();
    }

    void mainnetProvider().then(current => {
      if (disposed) return;
      if (typeof current.getBalance !== 'function') throw new Error('Update Nimiq Pay to view your NIM balance.');
      provider = current;
      current.on?.('accountsChanged', refresh);
      void refresh();
    }).catch(failure => {
      if (!disposed) setError(failure instanceof Error ? failure.message : 'Unable to connect to Nimiq Pay.');
    });

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const timer = window.setInterval(onFocus, 30_000);
    return () => {
      disposed = true;
      provider?.off?.('accountsChanged', refresh);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.clearInterval(timer);
    };
  }, [wallet, attempt]);

  const display = (luna: number | null) => luna === null ? 'Unavailable' : hidden ? '•••• NIM' : formatNim.format(luna / 100_000) + ' NIM';
  return <div className="info-note">
    <div>
      <strong>Nimiq Pay balance · Mainnet</strong>
      {balances ? <div aria-live="polite">
        <p>Available in Nimiq Pay: <strong>{display(balances.spendable)}</strong></p>
        <p>Personal wallet address: <strong>{display(balances.address)}</strong></p>
      </div> : <p role="status">{error || 'Checking your wallet balance…'}</p>}
      {(error || balances?.spendable === null || balances?.address === null) && <button className="text-button" type="button" onClick={() => {
        setBalances(null);
        setError('');
        setAttempt(value => value + 1);
      }}>Retry balance check</button>}
    </div>
  </div>;
}
