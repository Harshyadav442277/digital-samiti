'use client';

import { CalendarDays, ChevronDown, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Group, canOpenContribution, money, monthKey, round } from './model';
import { remainingInstallments } from './progress-model';

export function PendingPayments({ demo, groups, userId, hidden, contribute, reviewLoan }: {
  demo: boolean; groups: Group[]; userId: string; hidden: boolean;
  contribute: (groupId: string) => void; reviewLoan: (loanId: string) => void;
}) {
  const period = monthKey();
  const due = groups.filter(g => canOpenContribution(g, userId) && g.members.find(m => m.id === userId)?.paidMonth !== period);
  const loans = groups.flatMap(group => group.loans.filter(l => l.borrower === userId).map(loan => ({ group, loan, payments: remainingInstallments(loan) }))).filter(l => l.payments.length);
  const amount = (n: number) => hidden ? '•••• NIM' : `${money(n)} NIM`;
  const month = new Date(`${period}-10T12:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  return <section className="pending-payments" aria-labelledby="pending-payments-title">
    <div className="pending-heading"><span className="calendar-icon"><CalendarDays size={20}/></span><div><h2 id="pending-payments-title">Your pending payments</h2><p>{demo ? 'Across your Samitis · demo funds' : 'Across your Samitis'}</p></div></div>
    {!due.length && !loans.length ? <div className="payments-clear"><CheckCircle2 size={25}/><strong>You’re all caught up!</strong><p>{demo ? 'No monthly contributions or loan installments outstanding.' : 'No monthly contributions outstanding.'}</p></div> : <div className="pending-list">
      {due.map(g => <button key={g.id} className="pending-row" onClick={() => contribute(g.id)} aria-label={`Review contribution for ${g.name}`}><span className={`payment-dot ${g.color}`}/><span className="payment-description"><strong>{g.name}</strong><small>{month} contribution · due on the 10th</small></span><span className="payment-amount">{amount(g.monthly)}<ArrowUpRight size={15}/></span></button>)}
      {loans.map(({ group, loan, payments }) => <div className="pending-loan" key={loan.id}>
        <button className="pending-row" onClick={() => reviewLoan(loan.id)} aria-label={`Review installment for ${group.name}`}><span className={`payment-dot ${group.color}`}/><span className="payment-description"><strong>{group.name}</strong><small>Next loan installment · {payments[0].number} of {loan.months}</small></span><span className="payment-amount">{amount(payments[0].amount)}<ArrowUpRight size={15}/></span></button>
        <details className="remaining-payments"><summary><span>{amount(round(payments.reduce((s, p) => s + p.amount, 0)))} remaining · view installments</span><ChevronDown size={14}/></summary><ol>{payments.map(p => <li key={p.number}><span>Installment {p.number}</span><strong>{amount(p.amount)}</strong></li>)}</ol><p>Includes interest. Repayment dates are not recorded; these are outstanding amounts, not overdue notices.</p></details>
      </div>)}
    </div>}
  </section>;
}
