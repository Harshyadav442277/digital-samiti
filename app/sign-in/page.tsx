'use client';
import { useState, FormEvent } from 'react';
import { Sprout, ArrowLeft, LoaderCircle } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
export default function SignIn() {
  const [register,setRegister]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError('');const f=new FormData(e.currentTarget);
    try { const result=register ? await authClient.signUp.email({name:String(f.get('name')),email:String(f.get('email')),password:String(f.get('password'))}) : await authClient.signIn.email({email:String(f.get('email')),password:String(f.get('password'))});
      if(result.error)throw new Error(result.error.message || 'Please try again.');
      const requested=new URLSearchParams(location.search).get('return_to') || '/';const target=new URL(requested,location.origin);location.assign(target.origin===location.origin ? target.pathname+target.search : '/');
    } catch(e){setError(e instanceof Error?e.message:'Unable to sign in.');setBusy(false);}
  }
  return <main className="account-page"><a href="/" className="back-link"><ArrowLeft size={17}/>Back to your circle</a><div className="account-card"><span className="modal-symbol"><Sprout size={28}/></span><h1>{register?'Your circle starts here.':'Good to see you again.'}</h1><p>{register?'Create an account to save your Samitis across devices.':'Sign in to manage your groups and join your people.'}</p><form onSubmit={submit}>{register&&<label>Your name<input name="name" autoComplete="name" required maxLength={80}/></label>}<label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Password<input name="password" type="password" minLength={8} maxLength={128} autoComplete={register?'new-password':'current-password'} required/></label>{error&&<div className="form-error" role="alert">{error}</div>}<button className="button primary full" disabled={busy}>{busy&&<LoaderCircle className="spin" size={16}/>} {register?'Create account':'Sign in'}</button></form><button className="account-switch" onClick={()=>{setRegister(!register);setError('');}}>{register?'Already have an account? Sign in':'New here? Create an account'}</button><div className="info-note">Savings and lending use demo funds. No real-wallet automatic debits are enabled.</div></div></main>;
}
