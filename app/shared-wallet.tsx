'use client';

import { useState } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { type Group, type SamitiAction, sharedWalletReady, walletAddress } from './model';

const multisig = 'https://multisig.nimiq.com/';
const displayAddress = (address: string) => address.match(/.{1,4}/g)?.join(' ') ?? address;

export function SharedWalletStatus({ group, userId, open }: { group: Group; userId: string; open: () => void }) {
  const review = group.sharedWallet;
  const ready = sharedWalletReady(group);
  const owner = group.owner === userId;
  const canReview = review?.status === 'pending' && review.coSigner === userId;
  const coSigner = group.members.find(member => member.id === review?.coSigner);
  return <div className="info-note shared-wallet-status">
    <ShieldCheck size={20} />
    <div>
      <strong>{ready ? 'Shared wallet ready' : 'Shared wallet setup pending'}</strong>
      <p>{ready ? 'The organizer and co-signer confirmed the receiving address.'
        : review?.status === 'pending' ? `Waiting for ${coSigner?.name ?? 'the selected co-signer'} to confirm the address. New payments are paused.`
        : review?.status === 'mismatch' ? 'The co-signer reported a mismatch. New payments are paused.'
        : 'You can invite members now. Contributions open after a co-signer confirms the wallet.'}</p>
      {ready && <p className="shared-wallet-address"><code>{displayAddress(group.wallet)}</code></p>}
      {(owner || canReview) && <button type="button" className="button outline" onClick={open}>
        {canReview ? 'Review receiving address' : ready ? 'Change shared wallet' : review ? 'Manage wallet setup' : 'Set up shared wallet'}
      </button>}
    </div>
  </div>;
}

export function SharedWalletSetup({ group, userId, busy, action, invite }: {
  group: Group; userId: string; busy: boolean; action: SamitiAction; invite: () => void;
}) {
  const review = group.sharedWallet;
  const owner = group.owner === userId;
  const coSigners = group.members.filter(member => member.id !== userId && walletAddress(member.id));
  const [matches, setMatches] = useState(false);
  const canReview = review?.status === 'pending' && review.coSigner === userId;
  if (canReview) {
    return <>
      <p className="modal-description">Open your shared wallet in Nimiq Multisig and compare the full receiving address below. Confirm only if you are a signer and every character matches.</p>
      <MultisigLink />
      <div className="info-note"><div><strong>Proposed receiving address</strong><p className="shared-wallet-address"><code>{displayAddress(review.address)}</code></p></div></div>
      <label className="shared-wallet-check"><input type="checkbox" checked={matches} disabled={busy} onChange={event => setMatches(event.target.checked)} /> I’m a co-signer and the full address matches.</label>
      <div className="split-actions">
        <button type="button" className="button outline" disabled={busy} onClick={() => action('review-shared-wallet', { groupId: group.id, reviewId: review.id, matches: false }, 'Mismatch reported. Payments are paused.')}>Report mismatch</button>
        <button type="button" className="button primary" disabled={busy || !matches} onClick={() => action('review-shared-wallet', { groupId: group.id, reviewId: review.id, matches: true }, 'Address confirmed. Contributions are open.')}>Confirm address</button>
      </div>
    </>;
  }
  if (!owner) return <p className="modal-description">The organizer and selected co-signer handle wallet setup.</p>;

  return <>
    <ol className="shared-wallet-steps">
      <li><strong>Create or open your shared wallet.</strong> For a small group, start with three trusted signers and require two to approve payouts.</li>
      <li><strong>Copy the receiving address.</strong> It appears in Nimiq Multisig once all signers have joined.</li>
      <li><strong>Ask a co-signer to check it.</strong> Choose someone who is also a member of this Samiti.</li>
    </ol>
    <MultisigLink />
    {review?.status === 'pending' && <div className="info-note"><span>Waiting for co-signer confirmation of <code className="shared-wallet-address">{displayAddress(review.address)}</code>.</span></div>}
    {review?.status === 'mismatch' && <div className="info-note">Your co-signer reported a mismatch. Check the address in Nimiq Multisig and submit it again.</div>}
    {sharedWalletReady(group) && <div className="info-note">Saving a new address pauses new contributions until it is confirmed.</div>}
    {!coSigners.length ? <div className="info-note shared-wallet-status"><div><p>Invite a co-signer to join this Samiti before linking the wallet.</p><button className="button outline" type="button" onClick={invite}>Invite a co-signer</button></div></div>
      : <form key={review?.id} onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void action('propose-shared-wallet', { groupId: group.id, address: form.get('address'), coSigner: form.get('coSigner') }, 'Address saved. Ask your co-signer to review it.');
      }}>
        <label>Shared receiving address<input name="address" placeholder="NQ…" defaultValue={review ? displayAddress(review.address) : group.wallet} required maxLength={60} autoComplete="off" spellCheck={false} /></label>
        <label>Co-signer<select name="coSigner" required defaultValue={review?.coSigner ?? ''}>
          <option value="" disabled>Choose a member</option>
          {coSigners.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select></label>
        <button className="button primary full" disabled={busy} type="submit">Save for co-signer review</button>
      </form>}
    <p className="modal-description">Payout approvals happen in Nimiq Multisig. Digital Samiti records your address confirmation.</p>
  </>;
}

function MultisigLink() {
  return <a className="button outline" href={multisig} target="_blank" rel="noreferrer">Open Nimiq Multisig <ArrowUpRight size={15} /></a>;
}
