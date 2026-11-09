'use client';
import { CheckCircle2, Sprout } from 'lucide-react';
import { money } from './model';

export type ContributionReceipt = { id: string; groupName: string; amount: number; period: string; at: string; saved: number; target: number; mainnet?: boolean };
export function ContributionReceiptView({ receipt, done }: { receipt: ContributionReceipt; done: () => void }) {
  const progress = Math.min(100, receipt.saved / receipt.target * 100);
  return <div className="contribution-receipt">
    <div className="receipt-celebration" aria-hidden="true"><span className="receipt-coin">✦</span><CheckCircle2 size={44}/></div>
    <p className="modal-description">A little from you. A step forward for everyone.</p>
    <div className="receipt-paper"><span className="receipt-mode">Demo contribution · recorded</span><strong className="receipt-amount">{money(receipt.amount)} <small>NIM</small></strong><dl><div><dt>Samiti</dt><dd>{receipt.groupName}</dd></div><div><dt>Contribution month</dt><dd>{new Date(`${receipt.period}-10T12:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}</dd></div><div><dt>Recorded</dt><dd>{new Date(receipt.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} IST</dd></div></dl><div className="receipt-progress"><span><Sprout size={16}/> Your circle is {Math.round(progress)}% of the way</span><div className="progress"><span style={{ width: `${progress}%` }}/></div><small>{money(receipt.saved)} of {money(receipt.target)} NIM saved</small></div><details><summary>Receipt reference</summary><code>{receipt.id}</code></details></div>
    <p className="receipt-note">Saved to your group’s activity. No real money moved.</p><button className="button primary full" onClick={done}>Lovely, back to my circle</button>
  </div>;
}
