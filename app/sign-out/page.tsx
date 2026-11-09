'use client';

import { useEffect, useState } from 'react';
import { init } from '@nimiq/mini-app-sdk';
import { walletAuth } from '../wallet-sign-in';

export default function SignOut() {
  const [error, setError] = useState('');
  async function signOut() {
    setError('');
    try {
      await walletAuth('sign-out');
      try { sessionStorage.removeItem('samiti-demo-active'); } catch {}
      location.replace('/');
    } catch {
      setError('Sign-out could not be completed. Please try again.');
    }
  }

  useEffect(() => {
    if (window.nimiqPay) void init().then(provider => provider.disconnect()).catch(() => {});
    void signOut();
  }, []);

  return <div className="loading-state">{error
    ? <><p role="alert">{error}</p><button className="button outline" onClick={signOut}>Try again</button></>
    : 'Signing out…'}</div>;
}
