'use client';

import { useId, useState } from 'react';
import { Check, Sprout, Sparkles, CalendarDays } from 'lucide-react';
import { Group, groupSavings, money, monthKey } from './model';
import { projectGoal } from './progress-model';

export function GroupProgress({ group: g }: { group: Group }) {
  const [monthly, setMonthly] = useState(String(g.monthly));
  const inputId = useId();
  const period = monthKey();
  const paid = g.members.filter(m => m.paidMonth === period).length;
  const saved = groupSavings(g);
  const pct = Math.min(100, Math.floor(saved / g.target * 100));
  const value = Number(monthly);
  const valid = monthly.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 1000000 && Math.abs(Math.round(value * 100) - value * 100) < 1e-7;
  const forecast = projectGoal(g, valid ? value : 0, period);
  const [year, month] = period.split('-').map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const today = Number(new Date(Date.now() + 330 * 60000).toISOString().slice(8, 10));
  const recorded = new Set(g.activity.filter(a => a.type === 'contribution' && new Date(new Date(a.at).getTime() + 330 * 60000).toISOString().startsWith(period)).map(a => Number(new Date(new Date(a.at).getTime() + 330 * 60000).toISOString().slice(8, 10))));
  return <section className="circle-progress" aria-label="Shared progress">
    <div className="section-heading"><h2>Little steps, shared progress</h2><span>{pct}% of goal</span></div>
    <div className="panel shared-goal"><div className="shared-goal-heading"><span className="insight-icon green"><Sprout size={22}/></span><div><strong>{money(saved)} <small>NIM saved together</small></strong><p>Our goal: {money(g.target)} NIM</p></div></div><div className="progress" role="progressbar" aria-label="Shared savings goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: `${pct}%` }}/></div><div className="goal-milestones">{[25, 50, 75, 100].map(mark => <span key={mark} className={pct >= mark ? 'reached' : ''}>{pct >= mark && <Check size={12}/>} {mark}%<small>{pct >= mark ? 'Reached' : `${money(Math.max(0, g.target * mark / 100 - saved))} NIM to go`}</small></span>)}</div></div>
    <div className="progress-pair">
      <section className="panel monthly-circle"><h3><CalendarDays size={19}/> This month’s circle</h3><strong className="monthly-count">{paid} of {g.members.length} contributed</strong><p>{g.members.length - paid ? `${g.members.length - paid} still to contribute this month.` : 'Everyone has contributed. A lovely team effort.'}</p><div className="member-months">{g.members.map(m => <span key={m.id} className={m.paidMonth === period ? 'paid' : ''} title={`${m.name}: ${m.paidMonth === period ? 'contributed' : 'pending'}`} aria-label={`${m.name}: ${m.paidMonth === period ? 'contributed' : 'pending'}`}>{m.paidMonth === period ? <Check size={14}/> : m.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>)}</div>
        <details className="contribution-calendar"><summary>Contribution calendar · {new Date(`${period}-10T12:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}</summary><div className="month-grid">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <small key={`week-${i}`}>{d}</small>)}{Array.from({ length: offset }, (_, i) => <span key={`space-${i}`}/>)}{Array.from({ length: days }, (_, i) => i + 1).map(day => <span key={day} className={`${day === 10 ? 'due-day' : ''} ${recorded.has(day) ? 'recorded-day' : ''} ${day === today ? 'today' : ''}`} aria-label={`${day}${day === 10 ? ', contribution due date' : ''}${recorded.has(day) ? ', contribution recorded' : ''}${day === today ? ', today' : ''}`}>{day}</span>)}</div><p>Ring: today · purple: due date · dot: recorded contribution. Older sample records may be incomplete.</p></details>
      </section>
      <section className="panel goal-simulator"><h3><Sparkles size={19}/> Imagine your next milestone</h3><p>Try a different monthly contribution per member.</p><label htmlFor={inputId}>NIM per member / month</label><div className="simulator-input"><input id={inputId} type="number" min="0" max="1000000" step="0.01" value={monthly} aria-invalid={!valid} onChange={e => setMonthly(e.target.value)}/><button className="text-button" onClick={() => setMonthly(String(g.monthly))}>Reset</button></div><input className="goal-slider" type="range" min="0" max={Math.min(1000000, Math.max(g.monthly * 3, 100))} step="1" value={valid ? Math.min(value, Math.min(1000000, Math.max(g.monthly * 3, 100))) : 0} onChange={e => setMonthly(e.target.value)} aria-label="Explore monthly contribution"/>
        <div className="forecast-result" aria-live="polite">{!valid ? <strong>Enter 0–1,000,000 NIM, up to 2 decimals.</strong> : forecast.months === 0 ? <><small>Your shared savings goal</small><strong>Already reached ✦</strong></> : forecast.months === null ? <><small>With no new contributions</small><strong>No estimated goal date</strong></> : <><small>You could reach your savings goal by</small><strong>{forecast.date ? forecast.date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'More than 100 years away'}</strong><span>{forecast.months} monthly {forecast.months === 1 ? 'round' : 'rounds'} · {money(forecast.monthly)} NIM together</span>{forecast.projectedFund !== null && <span>Estimated available fund then: {money(forecast.projectedFund)} NIM</span>}</>}</div>
        <details className="forecast-assumptions"><summary>Preview only · see assumptions</summary><p>Starts next month. Every current member contributes the chosen amount each month, with no new loans or withdrawals. Savings progress counts contributions only. Available fund also includes remaining approved-loan installments, assuming one repayment per loan each month; these repayments are not counted as new savings. This does not change group rules or Auto Pay.</p></details>
      </section>
    </div>
  </section>;
}
