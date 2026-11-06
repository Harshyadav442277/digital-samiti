import { Group, loanTotal, monthKey, pool, round, groupSavings, validAddress } from './model';
import { changeAutoPay, processAutoPay } from './autopay';

export function updateGroup(g: Group, userId: string, action: string, input: Record<string, unknown>): Group {
  const member = g.members.find(m => m.id === userId);
  if (!member) throw new Error('Only group members can do that.');
  const activity = (label: string, amount: number, type: 'contribution' | 'loan' | 'repayment') => g.activity.unshift({ id: crypto.randomUUID(), member: member.name, label, amount, type, at: new Date().toISOString() });
  if (action === 'autopay') {
    changeAutoPay(g, userId, input);
    processAutoPay(g);
  } else if (action === 'payment-submitted') {
    if (!g.wallet || !validAddress(g.wallet)) throw new Error('The group has no testnet receiving wallet.');
    const hash = String(input.hash ?? '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid Nimiq transaction hash.');
    g.payments ??= [];
    if (!g.payments.some(p => p.hash === hash)) g.payments.unshift({ hash, memberId: userId, amount: g.monthly, recipient: g.wallet, network: 'testnet', status: 'submitted_unverified', at: new Date().toISOString(), month: monthKey() });
  } else if (action === 'contribute') {
    if (!g.demo) throw new Error('Verified on-chain settlement is not configured for this group.');
    if (member.paidMonth === monthKey()) throw new Error('Your contribution is already paid for this month.');
    member.saved = round(member.saved + g.monthly); member.paidMonth = monthKey();
    activity('Monthly contribution', g.monthly, 'contribution');
  } else if (action === 'loan') {
    if (!g.demo) throw new Error('Live lending is not enabled.');
    if (g.members.length < 2) throw new Error('Invite at least one other member before requesting a loan.');
    if (g.loans.some(l => l.borrower === userId && ['voting', 'approved'].includes(l.status))) throw new Error('You already have an active loan or request.');
    const amount = Number(input.amount); const months = Number(input.months); const reason = String(input.reason ?? '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || amount > pool(g) || round(amount) !== amount) throw new Error('Choose an amount within the available group fund, with up to 2 decimals.');
    if (!Number.isInteger(months) || months < 1 || months > g.months) throw new Error(`Repayment must be between 1 and ${g.months} months.`);
    if (round(amount * (1 + g.rate / 100 * months / 12)) < round(months * 0.01)) throw new Error('The amount is too small for this many installments. Choose a shorter repayment period.');
    if (reason.length < 8 || reason.length > 240) throw new Error('Tell your group why you need this loan (8–240 characters).');
    g.loans.unshift({ id: crypto.randomUUID(), borrower: userId, name: member.name, amount, reason, months, rate: g.rate, status: 'voting', votes: {}, voteAudit: [], requestedAt: new Date().toISOString(), repaid: 0, paidInstallments: 0, electorate: g.members.filter(m => m.id !== userId).map(m => m.id), threshold: g.threshold });
    activity('Requested a loan', amount, 'loan');
  } else if (action === 'vote') {
    const l = g.loans.find(l => l.id === input.loanId);
    if (!l || l.status !== 'voting') throw new Error('This vote is no longer open.');
    if (!l.electorate.includes(userId)) throw new Error('You are not eligible to vote on this request.');
    if (userId in l.votes) throw new Error('Your vote has already been recorded.');
    if (typeof input.approve !== 'boolean') throw new Error('Choose approve or decline.');
    l.votes[userId] = input.approve;
    l.voteAudit ??= [];
    l.voteAudit.push({ memberId: userId, name: member.name, approve: input.approve, at: new Date().toISOString() });
    const required = Math.ceil(l.electorate.length * l.threshold / 100);
    const yes = Object.values(l.votes).filter(Boolean).length;
    if (yes >= required) {
      if (l.amount > pool(g)) throw new Error('The fund no longer has enough available balance for this loan.');
      l.status = 'approved'; l.decidedAt = new Date().toISOString(); activity(`Loan approved for ${l.name}`, l.amount, 'loan');
    } else if (yes + l.electorate.length - Object.keys(l.votes).length < required) { l.status = 'rejected'; l.decidedAt = new Date().toISOString(); }
  } else if (action === 'repay') {
    if (!g.demo) throw new Error('Verified on-chain settlement is not configured.');
    const l = g.loans.find(l => l.id === input.loanId && l.borrower === userId && l.status === 'approved');
    if (!l) throw new Error('No repayable loan found.');
    const remaining = round(loanTotal(l) - l.repaid);
    const payment = l.paidInstallments >= l.months - 1 ? remaining : Math.min(remaining, round(loanTotal(l) / l.months));
    const totalInterest = round(loanTotal(l) - l.amount);
    const interest = payment === remaining ? round(totalInterest - (l.interestRepaid ?? 0)) : round(payment * totalInterest / loanTotal(l));
    const total = groupSavings(g);
    let allocated = 0;
    const owners = g.members.filter(m => m.saved > 0);
    owners.forEach((m, i) => { const share = i === owners.length - 1 ? round(interest - allocated) : round(interest * m.saved / total); m.interest = round(m.interest + share); allocated = round(allocated + share); });
    l.repaid = round(l.repaid + payment); l.paidInstallments++; l.interestRepaid = round((l.interestRepaid ?? 0) + interest);
    if (l.repaid >= loanTotal(l)) l.status = 'repaid';
    activity('Loan installment repaid', payment, 'repayment');
  } else throw new Error('Unknown action.');
  return g;
}
