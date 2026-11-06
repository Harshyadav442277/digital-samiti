import { AutoPayPlan, Group, round } from './model';

export const indiaDate = (now = new Date()) => new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
export function nextMonthlyDate(from: string, day: number, includeToday = true) {
  const [year, month] = from.split('-').map(Number);
  let next = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (next < from || (!includeToday && next === from)) next = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  return next;
}
function advance(date: string, day: number) { const [y, m] = date.split('-').map(Number); return new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10); }
function event(plan: AutoPayPlan, now: Date, type: AutoPayPlan['history'][number]['type'], label: string) { plan.history.unshift({ at: now.toISOString(), type, label }); plan.history = plan.history.slice(0, 48); }

export function changeAutoPay(g: Group, memberId: string, input: Record<string, unknown>, now = new Date()) {
  if (!g.demo) throw new Error('Real-wallet automatic debits are not supported.');
  if (!g.members.some(m => m.id === memberId)) throw new Error('Only members can manage their Auto Pay.');
  g.autoPay ??= {}; const plan = g.autoPay[memberId]; const operation = input.operation;
  if (operation === 'enable') {
    if (plan && plan.status !== 'cancelled') throw new Error('Manage your existing Auto Pay plan first.');
    if (input.consent !== true) throw new Error('Please authorize the demo monthly contribution.');
    const day = Number(input.day); if (!Number.isInteger(day) || day < 1 || day > 28) throw new Error('Choose a monthly date from 1 to 28.');
    const next: AutoPayPlan = { id: crypto.randomUUID(), mode: 'demo', status: 'active', amount: g.monthly, day, nextDate: nextMonthlyDate(indiaDate(now), day), createdAt: now.toISOString(), history: [] };
    event(next, now, 'enabled', 'Demo Auto Pay authorized'); g.autoPay[memberId] = next;
  } else {
    if (!plan) throw new Error('No Auto Pay plan found.');
    if (operation === 'pause' && plan.status === 'active') { plan.status = 'paused'; event(plan, now, 'paused', 'Auto Pay paused by you'); }
    else if (operation === 'resume' && plan.status === 'paused') { if (input.consent !== true) throw new Error('Please authorize resuming Auto Pay.'); plan.status = 'active'; plan.nextDate = nextMonthlyDate(indiaDate(now), plan.day); event(plan, now, 'resumed', 'Auto Pay resumed; paused months will not be collected'); }
    else if (operation === 'cancel' && plan.status !== 'cancelled') { plan.status = 'cancelled'; event(plan, now, 'cancelled', 'Auto Pay cancelled by you'); }
    else throw new Error('This change is not available for the current plan.');
  }
}

/** Only simulated savings. Never calls a wallet, sends a transaction, or handles keys. */
export function processAutoPay(g: Group, now = new Date()) {
  if (!g.demo) return { changed: false, contributions: 0 };
  const today = indiaDate(now); const month = today.slice(0, 7); let changed = false; let contributions = 0;
  for (const [memberId, plan] of Object.entries(g.autoPay ?? {})) {
    if (plan.mode !== 'demo' || plan.status !== 'active' || plan.nextDate > today) continue;
    const member = g.members.find(m => m.id === memberId);
    if (!member || plan.amount !== g.monthly) { plan.status = 'paused'; event(plan, now, 'paused', 'Plan needs review: membership or contribution changed'); changed = true; continue; }
    if (plan.nextDate.slice(0, 7) < month) { event(plan, now, 'skipped', 'Missed months skipped; no catch-up charges'); plan.nextDate = `${month}-${String(plan.day).padStart(2, '0')}`; changed = true; }
    if (plan.nextDate > today) continue;
    if (member.paidMonth === month || (member.paidMonth && member.paidMonth > month)) event(plan, now, 'skipped', 'Already contributed this month; no duplicate payment');
    else {
      member.saved = round(member.saved + plan.amount); member.paidMonth = month; contributions++;
      plan.history.unshift({ at: now.toISOString(), type: 'contribution', label: 'Automatic demo contribution', amount: plan.amount, period: month });
      g.activity.unshift({ id: crypto.randomUUID(), member: member.name, label: 'Auto Pay contribution · demo', amount: plan.amount, type: 'contribution', at: now.toISOString() });
    }
    plan.lastRun = now.toISOString(); plan.nextDate = advance(plan.nextDate, plan.day); plan.history = plan.history.slice(0, 48); changed = true;
  }
  g.activity = g.activity.slice(0, 1000);
  return { changed, contributions };
}
