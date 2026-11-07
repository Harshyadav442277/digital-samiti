'use client';

import { ArrowRight, LoaderCircle, Sprout, Users, Wallet } from 'lucide-react';
import { PiggyBank } from './friendly-art';

export function StartScreen({ busy, error, startDemo, returnTo }: {
  busy: boolean; error: string; startDemo: () => void; returnTo?: string;
}) {
  const suffix = returnTo ? '?return_to=' + encodeURIComponent(returnTo) : '';
  return <main className="welcome-page">
    <a className="welcome-brand" href="/"><span className="brand-mark"><Sprout size={26}/></span><strong>digital samiti<span>.</span></strong></a>
    <div className="welcome-grid">
      <section className="welcome-story">
        <span className="welcome-kicker">A LITTLE EACH. A LOT TOGETHER.</span>
        <h1>Your people.<br/>Your circle.<br/><span>Your fresh start.</span></h1>
        <p>Create a savings circle, set a shared goal, and build it together, one contribution at a time.</p>
        <div className="welcome-art"><PiggyBank/></div>
      </section>
      <section className="welcome-card" aria-labelledby="welcome-title">
        <span className="modal-symbol"><Users size={26}/></span>
        <h2 id="welcome-title">Make yourself at home.</h2>
        <p>Create an account to keep your circles across devices, or explore at your own pace.</p>
        <a className="button primary full" href={'/sign-up' + suffix}>Create account <ArrowRight size={17}/></a>
        <a className="button outline full" href={'/sign-in' + suffix}>Sign in</a>
        <div className="welcome-divider"><span/>or try it first<span/></div>
        <button className="welcome-demo" disabled={busy} onClick={startDemo}>
          <span className="insight-icon green"><Wallet size={21}/></span>
          <span><strong>{busy ? 'Opening your demo…' : 'Start an empty demo'}<small>0 NIM · no groups · no transactions</small></strong></span>
          {busy ? <LoaderCircle className="spin" size={19}/> : <ArrowRight size={19}/>}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="welcome-note">Your demo is personal to this browser. Create your first Samiti and record practice contributions yourself. All savings and payments use demo funds.</p>
      </section>
    </div>
  </main>;
}
