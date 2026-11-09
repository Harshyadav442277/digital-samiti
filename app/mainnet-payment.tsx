'use client';

import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, ShieldCheck, Wallet } from 'lucide-react';
import { NimiqProviderError } from '@nimiq/mini-app-sdk';
import { type Group, type SamitiAction, money, monthKey, walletAddress } from './model';
import { mainnetProvider } from './wallet-sign-in';

export function MainnetPayment({ group, userId, busy, setBusy, setError, action }: {
  group: Group; userId: string; busy: boolean; setBusy: (busy: boolean) => void;
  setError: (error: string) => void; action: SamitiAction;
}) {
  const intent = group.contributionIntents?.[userId];
  const paid = group.members.find(member => member.id === userId)?.paidMonth === monthKey();
  const [hash, setHash] = useState('');
  const paying = useRef(false);

  useEffect(() => {
    try { setHash(intent ? localStorage.getItem('samiti-mainnet-' + intent.reference) ?? '' : ''); }
    catch { setHash(''); }
  }, [intent?.reference]);

  async function pay() {
    if (paying.current || busy || paid || intent) return;
    paying.current = true;
    setBusy(true);
    setError('');
    let reference = '';
    try {
      const nimiq = await mainnetProvider();
      if (!await nimiq.isConsensusEstablished()) throw new Error('Wait for Nimiq Pay to connect to mainnet, then try again.');
      const accounts = (await nimiq.listAccounts()).map(account => account.toUpperCase().replace(/\s/g, ''));
      if (!accounts.includes(walletAddress(userId) ?? '')) throw new Error('Sign in again with your current Nimiq Pay wallet.');
      if (accounts.includes(group.wallet.toUpperCase().replace(/\s/g, ''))) throw new Error('The receiving address must be separate from your Nimiq Pay wallet.');
      setBusy(false);
      const requestId = crypto.randomUUID();
      const state = await action('mainnet-prepare', { groupId: group.id, requestId }, '', false);
      if (!state) return;
      const prepared = state.groups.find(item => item.id === group.id)?.contributionIntents?.[userId];
      if (!prepared || prepared.attempt !== requestId) throw new Error('An existing payment is open. Check it before paying again.');
      reference = prepared.reference;
      setBusy(true);
      const submitted = await nimiq.sendBasicTransactionWithData({
        recipient: group.wallet, value: Math.round(group.monthly * 100000), data: reference,
      });
      if (typeof submitted !== 'string' || !/^[a-f0-9]{64}$/i.test(submitted)) {
        throw new Error('Check Nimiq Pay history for the transaction hash before sending another payment.');
      }
      try { localStorage.setItem('samiti-mainnet-' + reference, submitted); } catch {}
      setHash(submitted);
    } catch (failure) {
      if (reference && NimiqProviderError.is(failure) && ['PERMISSION_DENIED', 'INVALID_TRANSACTION', 'UNKNOWN_REQUEST'].includes(failure.type)) {
        setBusy(false);
        const canceled = await action('mainnet-cancel', { groupId: group.id, reference }, '', false);
        if (canceled) setError(failure.type === 'PERMISSION_DENIED' ? 'Payment canceled in Nimiq Pay.' : 'Nimiq Pay could not start this payment. Check your wallet and try again.');
      } else {
        setError(reference ? 'Check your Nimiq Pay history for this payment before sending again.'
          : failure instanceof Error ? failure.message : 'Unable to open Nimiq Pay.');
      }
    } finally {
      paying.current = false;
      setBusy(false);
    }
  }

  async function verify() {
    if (!intent || !/^[a-f0-9]{64}$/i.test(hash.trim())) return;
    const candidate = hash.trim().toLowerCase();
    const state = await action('mainnet-confirm', { groupId: group.id, hash: candidate }, '', false);
    if (!state) return;
    const saved = state.groups.find(item => item.id === group.id);
    if (!saved?.contributionIntents?.[userId]) {
      try { localStorage.removeItem('samiti-mainnet-' + intent.reference); } catch {}
      if (!saved?.payments?.some(payment => payment.hash === candidate && payment.memberId === userId)) {
        setError('The mainnet transaction failed. You can start a new contribution.');
      }
    }
  }

  return <>
    <div className="info-note"><ShieldCheck size={20}/><span>Send real NIM to this Samiti’s receiving wallet. Check the amount and address in Nimiq Pay. Your savings update after mainnet confirmation.</span></div>
    <label>Receiving wallet<input value={group.wallet} readOnly/></label>
    {intent ? <>
      <p role="status">Payment started for {intent.month}. Check Nimiq Pay history if you need the hash.</p>
      <label>Transaction hash<input value={hash} maxLength={64} autoComplete="off" spellCheck={false} disabled={busy} onChange={event => setHash(event.target.value)}/></label>
      <button className="button primary full" type="button" disabled={busy || !/^[a-f0-9]{64}$/i.test(hash.trim())} onClick={verify}>
        {busy && <LoaderCircle size={17} className="spin"/>} Check mainnet confirmation
      </button>
    </> : <button className="button primary full" type="button" disabled={busy || paid} onClick={pay}>
      {busy ? <LoaderCircle size={17} className="spin"/> : <Wallet size={17}/>}
      {paid ? 'Already paid this month' : `Pay ${money(group.monthly)} NIM with Nimiq Pay`}
    </button>}
  </>;
}
