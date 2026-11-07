'use client';

import { useState, type FormEvent } from 'react';
import { ArrowLeft, LoaderCircle, Sprout } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

export function AccountForm({ register }: { register: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get('email')).trim();
    const password = String(fields.get('password'));
    try {
      const result = register
        ? await authClient.signUp.email({ name: String(fields.get('name')).trim(), email, password })
        : await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || 'Please try again.');
      const session = await authClient.getSession();
      if (!session.data?.user) {
        if (!register) throw new Error('Your sign-in could not be confirmed. Please try again.');
        setNotice('Your account was created. Check your email for any verification steps, then sign in.');
        setBusy(false);
        return;
      }
      const requested = new URLSearchParams(location.search).get('return_to') || '/#overview';
      const target = new URL(requested, location.origin);
      location.assign(target.origin === location.origin ? target.pathname + target.search + target.hash : '/#overview');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to sign in.');
      setBusy(false);
    }
  }

  function switchMode(event: React.MouseEvent<HTMLAnchorElement>) {
    const returnTo = new URLSearchParams(location.search).get('return_to');
    if (returnTo) event.currentTarget.href += `?return_to=${encodeURIComponent(returnTo)}`;
  }

  return <main className="account-page">
    <a href="/" className="back-link"><ArrowLeft size={17}/> Back to the start</a>
    <div className="account-card">
      <span className="modal-symbol"><Sprout size={28}/></span>
      <h1>{register ? 'Your circle starts here.' : 'Good to see you again.'}</h1>
      <p>{register ? 'Create your account and build your first Samiti from scratch.' : 'Sign in to your own groups, savings, and activity.'}</p>
      {notice ? <div role="status" className="account-notice"><p>{notice}</p><a className="button primary full" href="/sign-in">Continue to sign in</a></div> : <form onSubmit={submit}>
        {register && <label>Your name<input name="name" autoComplete="name" required maxLength={80}/></label>}
        <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
        <label>Password<input name="password" type="password" minLength={8} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} required/>{register && <small className="account-hint">At least 8 characters.</small>}</label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button primary full" disabled={busy}>{busy && <LoaderCircle className="spin" size={16}/>} {register ? 'Create account' : 'Sign in'}</button>
      </form>}
      <a className="account-switch" href={register ? '/sign-in' : '/sign-up'} onClick={switchMode}>{register ? 'Already have an account? Sign in' : 'New here? Create an account'}</a>
      <div className="info-note">New accounts start at zero. Savings and lending use demo funds.</div>
    </div>
  </main>;
}
