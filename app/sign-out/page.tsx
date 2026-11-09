'use client';

import { useState } from 'react';
import { init } from '@nimiq/mini-app-sdk';
import { walletAuth } from '../wallet-sign-in';

export default function SignOut() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await walletAuth('sign-out');
      try { sessionStorage.removeItem('samiti-demo-active'); } catch {}
      if (window.nimiq) void init().then(provider => provider.disconnect()).catch(() => {});
      location.replace('/');
    } catch {
      setError('Sign-out could not be completed. Please try again.');
      setBusy(false);
    }
  }

  return <main className="account-page">
    <section className="account-card">
      <h1>Sign out of Digital Samiti?</h1>
      <button className="button primary full" disabled={busy} onClick={signOut}>{busy ? 'Signing out…' : 'Sign out'}</button>
      <a className="button outline full" href="/#wallet">Back to wallet</a>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  </main>;
}
