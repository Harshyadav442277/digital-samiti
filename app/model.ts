export type Member = { id: string; name: string; saved: number; interest: number; paidMonth?: string };
export type Activity = { id: string; member: string; label: string; amount: number; at: string; type: 'contribution' | 'loan' | 'repayment' | 'joined' };
export type VoteEntry = { memberId: string; name: string; approve: boolean; at: string };
export type Loan = { id: string; borrower: string; name: string; amount: number; reason: string; months: number; rate: number; status: 'voting' | 'approved' | 'rejected' | 'repaid'; votes: Record<string, boolean>; voteAudit?: VoteEntry[]; requestedAt?: string; decidedAt?: string; repaid: number; paidInstallments: number; interestRepaid?: number; electorate: string[]; threshold: number };
export type AutoPayEvent = { at: string; type: 'enabled' | 'paused' | 'resumed' | 'cancelled' | 'contribution' | 'skipped'; label: string; amount?: number; period?: string };
export type AutoPayPlan = { id: string; mode: 'demo'; status: 'active' | 'paused' | 'cancelled'; amount: number; day: number; nextDate: string; createdAt: string; lastRun?: string; history: AutoPayEvent[] };
export type Payment = { hash: string; memberId: string; amount: number; recipient: string; network: 'testnet'; status: 'submitted_unverified'; at: string; month: string };
export type Group = { id: string; owner: string; name: string; description: string; visibility: 'public' | 'private'; color: string; icon: string; monthly: number; target: number; rate: number; months: number; threshold: number; rules: string; wallet: string; invite: string; demo: boolean; members: Member[]; loans: Loan[]; activity: Activity[]; autoPay?: Record<string, AutoPayPlan>; payments?: Payment[]; created: string };
export type AppState = { groups: Group[]; user: { id: string; name: string; authenticated: boolean }; publicGroups: { id: string; name: string; description: string; monthly: number; count: number; color: string; icon: string }[] };
export const money = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
// Monthly contribution windows follow the app's Indian community calendar.
export const monthKey = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
export const round = (n: number) => Math.round(n * 100) / 100;
export const groupSavings = (g: Group) => round(g.members.reduce((s, m) => s + m.saved, 0));
export const loanTotal = (l: Loan) => round(l.amount * (1 + l.rate / 100 * l.months / 12));
export const pool = (g: Group) => round(groupSavings(g) + g.members.reduce((s, m) => s + m.interest, 0) - g.loans.filter(l => l.status === 'approved').reduce((s, l) => s + l.amount - (l.repaid - (l.interestRepaid ?? 0)), 0));
export function validAddress(address: string) {
  const a = address.toUpperCase().replace(/\s/g, '');
  if (!/^NQ\d{2}[0-9A-HJ-NP-VXY]{32}$/.test(a)) return false;
  const digits = (a.slice(4) + a.slice(0, 4)).split('').map(c => /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c).join('');
  let remainder = 0; for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  return remainder === 1;
}
export function makeDemo(userId: string, name: string): Group[] {
  const names = ['Campus circle', 'Family & friends', 'The dream team'];
  const otherNames = ['Aditi Sharma', 'Rahul Mehta', 'Priya Patel', 'Arjun Singh', 'Neha Verma', 'Rohan Das', 'Isha Rao'];
  return names.map((groupName, i) => {
    const id = `demo-${userId}-${i}`;
    const members: Member[] = [{ id: userId, name, saved: [6000, 3000, 1200][i], interest: [240, 180, 60][i] }, ...otherNames.slice(0, [7, 5, 3][i]).map((n, j) => ({ id: `${id}-m${j}`, name: n, saved: [3000, 2640, 2266.67][i], interest: 0, paidMonth: monthKey() }))];
    const g: Group = { id, owner: userId, name: groupName, description: ['Small savings. Big campus dreams.', 'Growing together, one month at a time.', 'A little closer to our next big thing.'][i], visibility: 'private', color: ['peach', 'green', 'blue'][i], icon: ['graduation', 'heart', 'sparkles'][i], monthly: [1000, 1500, 500][i], target: [40000, 30000, 20000][i], rate: 6, months: 6, threshold: 60, rules: 'Contribute by the 10th each month. One active loan per member. Interest is shared in proportion to savings when a repayment is recorded.', wallet: '', invite: crypto.randomUUID().replace(/-/g, '').toUpperCase(), demo: true, members, loans: [], activity: [], created: new Date().toISOString() };
    if (i === 0) g.loans = [{ id: crypto.randomUUID(), borrower: members[1].id, name: members[1].name, amount: 5000, reason: 'A new laptop for my final-year project', months: 6, rate: 6, status: 'voting', votes: { [members[2].id]: true, [members[3].id]: true, [members[4].id]: true }, repaid: 0, paidInstallments: 0, electorate: members.slice(2).map(m => m.id).concat(userId), threshold: 60 }];
    if (i === 1) g.loans = [{ id: crypto.randomUUID(), borrower: userId, name, amount: 3000, reason: 'A little support for a new learning setup', months: 6, rate: 6, status: 'approved', votes: Object.fromEntries(members.slice(1, 4).map(m => [m.id, true])), repaid: 0, paidInstallments: 0, interestRepaid: 0, electorate: members.slice(1).map(m => m.id), threshold: 60 }];
    if (i === 2) members[members.length - 1].saved = 2266.66;
    g.activity = members.slice(1, 4).map((m, j) => ({ id: crypto.randomUUID(), member: m.name, label: 'Monthly contribution', amount: g.monthly, type: 'contribution', at: new Date(Date.now() - (j + 1) * 3600000).toISOString() }));
    return g;
  });
}
