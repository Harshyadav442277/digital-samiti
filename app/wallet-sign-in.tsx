'use client';

import { useRef, useState } from 'react';
import { LoaderCircle, Wallet } from 'lucide-react';
import { getHostNetwork, init, NimiqProviderError } from '@nimiq/mini-app-sdk';

export async function walletAuth(action: string, fields: Record<string, unknown> = {}) {
  const response = await fetch('/api/wallet-auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...fields }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Wallet sign-in is unavailable.');
  return data;
}

export async function mainnetProvider() {
  const network = getHostNetwork();
  if (network === 'testnet') throw new Error('Switch Nimiq Pay to Mainnet and reopen Digital Samiti.');
  if (network !== 'mainnet') throw new Error('Open Digital Samiti in an up-to-date Nimiq Pay app to use your wallet.');
  return init();
}

export function WalletSignIn({ returnTo, disabled }: { returnTo?: string; disabled?: boolean }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const nimiq = await mainnetProvider();
      const accounts = await nimiq.listAccounts();
      if (!accounts.length) throw new Error('No Nimiq accounts were shared.');
      const { message } = await walletAuth('challenge');
      const { publicKey, signature } = await nimiq.sign(message);
      await walletAuth('verify', { accounts, publicKey, signature });
      try { sessionStorage.removeItem('samiti-demo-active'); } catch {}
      const requested = returnTo ?? new URLSearchParams(location.search).get('return_to');
      const target = new URL(requested || '/', location.origin);
      location.replace(target.origin === location.origin && target.pathname === '/' ? target.href : '/');
    } catch (failure) {
      setError(NimiqProviderError.is(failure) && failure.type === 'PERMISSION_DENIED'
        ? 'Wallet sign-in was canceled. You can try again.'
        : failure instanceof Error ? failure.message : 'Unable to sign in with Nimiq Pay.');
      pending.current = false;
      setBusy(false);
    }
  }

  return <>
    <button className="button primary full" type="button" disabled={busy || disabled} onClick={signIn}>
      {busy ? <LoaderCircle className="spin" size={17}/> : <Wallet size={17}/>}
      {busy ? 'Check your Nimiq Pay wallet…' : 'Sign in with Nimiq Pay'}
    </button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </>;
}
