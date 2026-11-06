"use client";

import { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, ArrowLeft, Plus, X, LayoutGrid, Users, Wallet, Vote, Bell, ChevronRight, ChevronDown, Check, LockKeyhole, Globe, HelpCircle, Sprout, CalendarDays, Search, ShieldCheck, CircleHelp, LoaderCircle, RefreshCw, CheckCircle2, TrendingUp, Palette, Eye, EyeOff } from 'lucide-react';
import { AppState, Group, Loan, money, groupSavings, pool, monthKey } from './model';
import { GroupArt } from './illustrations';
import { SamitiModal, ModalKind } from './samiti-modal';
import { LoanCard } from './loan-card';
import { ContributionSchedule } from './contribution-schedule';

import { PiggyBank, ActionArt, GoalRing } from './friendly-art';
import { ActivityLedger } from './activity-ledger';
import { Appearance } from './appearance-panel';
import { PendingPayments } from './pending-payments';
import { GroupProgress } from './group-progress';
import { ContributionReceipt } from './contribution-receipt';

type View = 'overview' | 'groups' | 'loans' | 'wallet';
const navigation = [{ id: 'overview', label: 'Overview', Icon: LayoutGrid }, { id: 'groups', label: 'My Samitis', Icon: Users }, { id: 'loans', label: 'Loans & votes', Icon: Vote }, { id: 'wallet', label: 'Wallet', Icon: Wallet }] as const;
const initials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
export function Avatar({ name, index = 0, small = false }: { name: string; index?: number; small?: boolean }) { return <span className={`avatar avatar-${index % 6} ${small ? 'small' : ''}`} title={name}>{initials(name)}</span>; }
function Avatars({ group }: { group: Group }) { return <div className="member-preview"><span className="avatar-stack">{group.members.slice(0, 4).map((m, i) => <Avatar key={m.id} name={m.name} index={i} small />)}</span><span>{group.members.length} members</span></div>; }

export default function DigitalSamiti() {
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<View>('overview');
  const [focusedLoan, setFocusedLoan] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ContributionReceipt | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [modalGroup, setModalGroup] = useState('');
  const [detailTab, setDetailTab] = useState('Overview');
  const [groupTab, setGroupTab] = useState('Joined');
  const [loanTab, setLoanTab] = useState('All requests');
  const [query, setQuery] = useState('');
  const [groupSort, setGroupSort] = useState('recent');
  const [balanceMode, setBalanceMode] = useState<'savings'|'community'>('savings');
  const [appearance,setAppearance] = useState<Appearance>({theme:'warm',hideBalance:false,compact:false});
  function updateAppearance(next:Appearance) { setAppearance(next); try {localStorage.setItem('samiti-appearance',JSON.stringify(next));} catch {} }
  useEffect(()=>{try {const saved=JSON.parse(localStorage.getItem('samiti-appearance')||'null');if(saved&&['warm','lilac','mint'].includes(saved.theme))setAppearance({theme:saved.theme,hideBalance:saved.hideBalance===true,compact:saved.compact===true});}catch{}},[]);
  useEffect(()=>{document.documentElement.dataset.theme=appearance.theme;document.documentElement.dataset.compact=String(appearance.compact);},[appearance]);
  useEffect(()=>{const read=()=>{const parts=(location.hash.slice(1) || 'overview').split('/');if(['overview','groups','loans','wallet'].includes(parts[0])){setView(parts[0] as View);try{setSelected(parts[0]==='groups'&&parts[1]?decodeURIComponent(parts[1]):null);setFocusedLoan(parts[0]==='loans'&&parts[1]?decodeURIComponent(parts[1]):null);}catch{setSelected(null);setFocusedLoan(null);}setDetailTab('Overview');}};read();window.addEventListener('hashchange',read);return()=>window.removeEventListener('hashchange',read);},[]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [wallet, setWallet] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const mutationVersion = useRef(0); const busyRef = useRef(busy); busyRef.current = busy;
  const [syncStatus, setSyncStatus] = useState('Up to date');
  const groups = state?.groups ?? [];
  const userId = state?.user.id ?? '';
  const active = groups.find(g => g.id === selected);
  const targetGroup = groups.find(g => g.id === modalGroup) ?? groups[0];
  const mySavings = groups.reduce((s, g) => s + (g.members.find(m => m.id === userId)?.saved ?? 0), 0);
  const myInterest = groups.reduce((s, g) => s + (g.members.find(m => m.id === userId)?.interest ?? 0), 0);
  const allLoans = groups.flatMap(g => g.loans.map(l => ({ ...l, group: g })));
  const pendingVotes = allLoans.filter(l => l.status === 'voting' && l.electorate.includes(userId) && !(userId in l.votes));
  const visibleLoans = focusedLoan ? allLoans.filter(l => l.id === focusedLoan)
    : loanTab === 'Needs your vote' ? pendingVotes
    : loanTab === 'My loans' ? allLoans.filter(l => l.borrower === userId)
    : allLoans;
  const activities = groups.flatMap(g => g.activity.map(a => ({ ...a, groupName: g.name }))).sort((a, b) => b.at.localeCompare(a.at));
  const receipts = groups.flatMap(g => (g.payments ?? []).map(p => ({ ...p, groupName: g.name })));
  const dueGroups = groups.filter(g => g.members.find(m => m.id === userId)?.paidMonth !== monthKey());
  const visibleGroups=groups.filter(g=>g.name.toLowerCase().includes(query.toLowerCase())).slice().sort((a,b)=>groupSort==='saved'?groupSavings(b)-groupSavings(a):groupSort==='progress'?groupSavings(b)/b.target-groupSavings(a)/a.target:b.created.localeCompare(a.created));
  const balanceAmount=new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(balanceMode==='savings'?mySavings:groups.reduce((sum,g)=>sum+pool(g),0)).split('.');
  async function load() {
    setError('');
    try {
      const res = await fetch('/api/samiti'); const data = await res.json() as AppState & { error?: string }; if (!res.ok) throw new Error(data.error);
      if (data.groups.length === 0) { const seed = await fetch('/api/samiti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'bootstrap' }) }); const seeded = await seed.json() as AppState & { error?: string }; if (!seed.ok) throw new Error(seeded.error); setState(seeded); }
      else setState(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load.'); }
  }
  useEffect(() => { void load(); const saved = localStorage.getItem('samiti-wallet'); if (saved) setWallet(saved); const code = new URLSearchParams(location.search).get('invite'); if (code) { setInviteCode(code); setModal('join'); } }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    let disposed = false; const refresh = async () => {
      if (document.visibilityState !== 'visible' || busyRef.current) return;
      const version = mutationVersion.current;
      try { const res = await fetch('/api/samiti'); if (!res.ok) throw new Error(); const data = await res.json() as AppState; if (!disposed && !busyRef.current && version === mutationVersion.current) { setState(data); setSyncStatus('Up to date'); } } catch { if (!disposed) setSyncStatus('Offline · showing saved data'); }
    };
    const timer = setInterval(refresh, 15000); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  function navigate(next: View) { setFocusedLoan(null); setView(next); setSelected(null); setQuery(''); location.hash=next; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function reviewLoan(id: string) { setModal(null); setFocusedLoan(id); setLoanTab('All requests'); setView('loans'); setSelected(null); location.hash=`loans/${encodeURIComponent(id)}`; }
  useEffect(() => { if (focusedLoan && state && view === 'loans') { const card = document.getElementById(`loan-${focusedLoan}`); card?.focus({preventScroll:true}); card?.scrollIntoView({behavior:'smooth',block:'start'}); } }, [focusedLoan, view, !!state]);
  function open(next: ModalKind, groupId?: string) { setModalGroup(groupId ?? groups[0]?.id ?? ''); setModal(next); setFormError(''); }
  function groupDetail(g: Group) { setSelected(g.id); setDetailTab('Overview'); setView('groups'); location.hash=`groups/${encodeURIComponent(g.id)}`; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  async function action(actionName: string, payload: Record<string, unknown> = {}, message = 'Saved successfully', close = true) {
    if (busyRef.current) return false; busyRef.current = true; mutationVersion.current++; setBusy(true); setFormError('');
    try {
      const res = await fetch('/api/samiti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionName, requestId: crypto.randomUUID(), ...payload }) });
      const data = await res.json() as AppState & { error?: string }; if (!res.ok) throw new Error(data.error);
      setState(data);
      const updated = data.groups.find(g => g.id === payload.groupId);
      const previous = groups.find(g => g.id === payload.groupId);
      const entry = updated?.activity.find(a => a.type === 'contribution' && !previous?.activity.some(old => old.id === a.id));
      if (actionName === 'contribute' && updated && entry) {
        setReceipt({id:entry.id,groupName:updated.name,amount:entry.amount,period:updated.members.find(m=>m.id===data.user.id)?.paidMonth ?? monthKey(),at:entry.at,saved:groupSavings(updated),target:updated.target});
        setToast(''); setModal('receipt');
      } else { setToast(message); if (close) setModal(null); }
      return true;
    } catch (e) { const message = e instanceof Error ? e.message : 'Please try again.'; if (modal) setFormError(message); else setToast(message); return false; } finally { busyRef.current = false; setBusy(false); }
  }
  function downloadReminder(g: Group) {
    const now = new Date(); const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10, 4, 30)); if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); const safe = (s: string) => s.replace(/[\r\n]/g, ' ').replace(/[,;\\]/g, ' ');
    const content = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Digital Samiti//Contributions//EN\r\nBEGIN:VEVENT\r\nUID:${crypto.randomUUID()}@digital-samiti\r\nDTSTAMP:${stamp(now)}\r\nDTSTART:${stamp(next)}\r\nRRULE:FREQ=MONTHLY;BYMONTHDAY=10\r\nSUMMARY:${safe(g.name)} contribution\r\nDESCRIPTION:Contribute ${g.monthly} NIM. Open Digital Samiti to review and approve. This reminder does not move funds.\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar' })); const a = document.createElement('a'); a.href = url; a.download = 'samiti-monthly-reminder.ics'; a.click(); URL.revokeObjectURL(url); setToast('Monthly calendar reminder downloaded');
  }
  function GroupCard({ g }: { g: Group }) { const pct = Math.min(100, Math.round(groupSavings(g) / g.target * 100)); return <button className={`group-card ${g.color}`} onClick={() => groupDetail(g)}><div className="group-card-top"><GoalRing value={pct}><GroupArt type={g.icon} /></GoalRing><span className="privacy"><LockKeyhole size={11} /> {g.visibility === 'private' ? 'Private' : 'Public'}</span><ArrowUpRight className="card-arrow" size={20} /></div><div className="group-card-content"><h3>{g.name}</h3><p>{money(g.monthly)} NIM <span>/ month</span></p><div className="progress"><span style={{ width: `${pct}%` }} /></div><div className="group-progress-label"><strong>{money(groupSavings(g))} <small>NIM saved</small></strong><span>{pct}%</span></div><Avatars group={g} /></div></button>; }


  return <div className={`app-shell view-${view}`}><aside className="sidebar"><a href="/" className="brand"><span className="brand-mark"><Sprout size={26} strokeWidth={2.3} /></span><span>digital<span className="brand-second">samiti<span className="brand-dot">.</span></span></span></a><div className="sidebar-caption">A little each. A lot together.</div><nav aria-label="Main navigation">{navigation.map(n => <button key={n.id} aria-current={view===n.id?'page':undefined} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => navigate(n.id)}><n.Icon size={21} /><span>{n.label}</span>{n.id === 'loans' && pendingVotes.length > 0 && <span className="nav-count">{pendingVotes.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="community-note"><span className="tiny-flower">✳</span><h4>Better, together.</h4><p>Your people. Your goals.<br />Your way to grow.</p><button onClick={() => open('create')}>Start a Samiti <ArrowUpRight size={15} /></button></div><button className="nav-item help-link" onClick={() => open('help')}><HelpCircle size={20} /> Help & how it works</button><button className="sidebar-profile" onClick={() => open('wallet')}><Avatar name={state?.user.name || 'Harsh'} index={4} /><span><strong>{state?.user.name || 'Harsh'}</strong><small>{state?.user.authenticated ? 'Your community account' : 'Exploring Digital Samiti'}</small></span><ChevronDown size={15} /></button></div></aside>
  <main className="main"><header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Sprout size={22} /></span><strong>digital samiti<span>.</span></strong></div><div className="breadcrumb">Your money, in good company <span>✳</span></div><div className="topbar-actions"><button className="icon-button appearance-button" onClick={()=>open('appearance')} aria-label="Personalize appearance"><Palette size={21}/></button>{view !== 'wallet' && <button className="wallet-connect" onClick={() => open('wallet')}><span className="nimiq-hex" />{wallet ? 'Wallet connected' : 'Connect wallet'}</button>}<button className="icon-button notification-button" onClick={() => open('notifications')} aria-label="Notifications"><Bell size={21} />{dueGroups.length > 0 && <i />}</button><button className="profile-button" onClick={() => open('wallet')} aria-label="Your profile"><Avatar name={state?.user.name || 'Harsh'} index={4} /></button></div></header>
    <div className="page-content">{(view === 'groups' || view === 'loans') && <div className="demo-bar"><span><span className="demo-dot" /> Demo workspace <span className="demo-separator">·</span> <span className="demo-description">Explore with sample funds</span></span><button onClick={() => open('help')}>How it works <ArrowUpRight size={13} /></button></div>}
    {error ? <div className="empty error-state"><CircleHelp size={40} /><h2>Let’s try that again.</h2><p>{error}</p><button className="button primary" onClick={load}><RefreshCw size={16} /> Reload workspace</button></div> : !state ? <div className="loading-state"><LoaderCircle className="spin" size={30} /><p>Getting your circle ready…</p></div> : <>
    {active ? <>
      <button className="back-link" onClick={() => navigate('groups')}><ArrowLeft size={17} /> My Samitis</button><div className="page-heading group-detail-heading"><div className={`detail-art ${active.color}`}><GroupArt type={active.icon} /></div><div><h1>{active.name}</h1><p>{active.description}</p></div><button className="button outline" onClick={() => open('invite', active.id)}><Plus size={16} /> Invite</button></div><div className={`detail-summary ${active.color}`}><div><span>Available group fund</span><h2>{money(pool(active))} <small>NIM</small></h2><Avatars group={active} /></div><div className="detail-summary-stats"><p>Monthly contribution<strong>{money(active.monthly)} NIM</strong></p><p>Annual loan interest<strong>{active.rate}%</strong></p></div></div><div className="detail-actions"><button className="button primary" onClick={() => open('contribute', active.id)}><Plus size={17} /> Add contribution</button><button className="button outline" onClick={() => open('loan', active.id)}><ArrowUpRight size={17} /> Request a loan</button></div><div className="tabs detail-tabs">{['Overview', 'Members', 'Activity', 'Rules'].map(t => <button key={t} className={detailTab === t ? 'selected' : ''} onClick={() => setDetailTab(t)}>{t}</button>)}</div>
      {detailTab === 'Overview' && <><GroupProgress key={active.id} group={active}/><div className="section-heading"><h2>Loans & requests</h2><button className="text-button" onClick={() => open('loan', active.id)}>New request <Plus size={15} /></button></div><div className="loan-grid">{active.loans.length ? active.loans.map(l => <LoanCard userId={userId} busy={busy} action={action} key={l.id} loan={{ ...l, group: active }} />) : <div className="panel empty"><Vote size={30} /><h3>No loans just yet</h3><p>Your next big idea could start with your circle.</p></div>}</div></>}
      {detailTab === 'Members' && <div className="panel member-list"><div className="member-table-heading"><span>Member</span><span>Savings / ownership</span></div>{active.members.map((m, i) => <div key={m.id} className="member-row"><Avatar name={m.name} index={i} /><div><strong>{m.name}{m.id === userId ? ' (you)' : ''}</strong><p>{m.id === active.owner ? 'Group admin' : 'Member'} · {m.paidMonth === monthKey() ? 'Paid this month' : 'Contribution due'}</p></div><div className="member-savings"><strong>{money(m.saved)} NIM</strong><small>{groupSavings(active) ? (m.saved / groupSavings(active) * 100).toFixed(1) : '0'}% share</small></div></div>)}</div>}
      {detailTab === 'Activity' && <section className="panel"><ActivityLedger items={active.activity.map(a => ({ ...a, groupName: active.name }))} limit={1000} /></section>}
      {detailTab === 'Rules' && <div className="panel rules-panel"><h3>Our agreement</h3><p className="preserve-lines">{active.rules || 'No additional rules have been added.'}</p><dl><div><dt>Approval threshold</dt><dd>{active.threshold}% of eligible members</dd></div><div><dt>Maximum repayment period</dt><dd>{active.months} months</dd></div><div><dt>Interest method</dt><dd>{active.rate}% simple annual interest</dd></div><div><dt>Interest ownership</dt><dd>Proportional to savings at each repayment</dd></div><div><dt>Voting eligibility</dt><dd>Members at request time, excluding the borrower</dd></div><div><dt>Monthly due date</dt><dd>10th of each month</dd></div><div><dt>Fund mode</dt><dd>Demo ledger · no real money</dd></div></dl><div className="info-note"><ShieldCheck size={19} /><span>A group ledger is not a multisignature wallet. Automated collections and live lending are not enabled.</span></div></div>}
    </> : view === 'overview' ? <>
      <h1 className="sr-only">Home</h1>
      <div className="hero-grid"><section className="balance-card"><div className="balance-content"><div className="balance-tabs"><button aria-pressed={balanceMode==='savings'} onClick={()=>setBalanceMode('savings')}>Your savings</button><button aria-pressed={balanceMode==='community'} onClick={()=>setBalanceMode('community')}>Group fund</button></div><div className="balance-eyebrow">{balanceMode==='savings'?'A little saved. A lot possible.':'Available across your circles'}<button className="balance-privacy" aria-label={appearance.hideBalance?'Show balances':'Hide balances'} onClick={()=>updateAppearance({...appearance,hideBalance:!appearance.hideBalance})}>{appearance.hideBalance?<EyeOff size={17}/>:<Eye size={17}/>}</button></div><div className="balance-amount" aria-live="polite">{appearance.hideBalance?'••••':balanceAmount[0]}{!appearance.hideBalance&&<span>.{balanceAmount[1]}</span>} <small>NIM</small></div><span className="balance-pill"><Sprout size={13}/> Growing together in {groups.length} Samitis</span></div><div className="piggy-art"><PiggyBank/></div><div className="hero-footer"><span>Little by little. Together.</span><span className="hero-sparkle">✦</span></div></section><PendingPayments groups={groups} userId={userId} hidden={appearance.hideBalance} contribute={id => open('contribute',id)} reviewLoan={reviewLoan}/></div>
      <div className="quick-actions" aria-label="Quick actions">{([{art:'save',label:'Contribute',modal:'contribute'},{art:'autopay',label:'Auto Pay',modal:'autopay'},{art:'loan',label:'Get a loan',modal:'loan'},{art:'invite',label:'Invite',modal:'invite'}] as const).map(a=><button key={a.art} onClick={()=>open(a.modal,a.modal==='contribute'?dueGroups[0]?.id:undefined)}><span className={`action-tile action-${a.art}`}><ActionArt type={a.art}/></span><strong>{a.label}</strong></button>)}</div>
      <div className="home-insights">
        <div className="home-insight"><span className="insight-icon purple"><TrendingUp size={20} /></span><strong>{appearance.hideBalance?'••••':money(myInterest)}</strong><small>NIM earned</small></div>
        <button className="home-insight" onClick={() => { setLoanTab(pendingVotes.length ? 'Needs your vote' : 'All requests'); navigate('loans'); }}><span className="insight-icon peach"><Vote size={20} /></span><strong>{pendingVotes.length}</strong><small>{pendingVotes.length === 1 ? 'vote needs you' : 'votes need you'}</small></button>
      </div>
    </> : view === 'groups' ? <>
      <div className="page-heading"><div><div className="eyebrow">YOUR PEOPLE, YOUR POSSIBILITIES</div><h1>My Samitis<span className="heading-dot">.</span></h1><p>A shared future starts with a small circle.</p></div><button className="button primary" onClick={() => open('create')}><Plus size={17} /> Create a Samiti</button></div><div className="group-toolbar"><div className="tabs">{['Joined', 'Explore'].map(t => <button key={t} className={groupTab === t ? 'selected' : ''} onClick={() => setGroupTab(t)}>{t}</button>)}</div><button className="text-button" onClick={() => open('join')}>Join with code <Plus size={16} /></button></div><div className="group-search-sort"><label className="search-box"><Search size={18} /><input aria-label="Search Samitis" placeholder="Find your circle…" value={query} onChange={e => setQuery(e.target.value)} /></label>{groupTab==='Joined'&&<select aria-label="Sort Samitis" value={groupSort} onChange={e=>setGroupSort(e.target.value)}><option value="recent">Newest first</option><option value="saved">Most saved</option><option value="progress">Goal progress</option></select>}</div>
      {groupTab === 'Joined' ? <div className="group-grid">{visibleGroups.length?visibleGroups.map(g => <GroupCard key={g.id} g={g} />):<div className="panel empty full-grid"><Search size={27}/><h3>No circles match yet.</h3><p>Try a different name or start a new Samiti.</p><button className="text-button" onClick={()=>setQuery('')}>Clear search <X size={14}/></button></div>}<button className="new-group-card" onClick={() => open('create')}><span><Plus size={25} /></span><strong>A new circle of possibilities</strong><p>Create a Samiti with your people</p></button></div> : <div className="group-grid">{state.publicGroups.filter(g => g.name.toLowerCase().includes(query.toLowerCase())).length ? state.publicGroups.filter(g => g.name.toLowerCase().includes(query.toLowerCase())).map(g => <article className={`explore-card ${g.color}`} key={g.id}><span className="group-art"><GroupArt type={g.icon} /></span><h3>{g.name}</h3><p>{g.description}</p><strong>{money(g.monthly)} NIM / month</strong><p>{g.count} members · Practice group</p><button className="button primary" disabled={busy || groups.some(m => m.id === g.id)} onClick={() => action('join', { publicId: g.id }, 'Welcome to your new circle!')}>{groups.some(m => m.id === g.id) ? 'Already joined' : 'Join this Samiti'}</button></article>) : <div className="panel empty full-grid"><Globe size={35} /><h3>The next circle could be yours</h3><p>No public Samitis match yet. Create one or join a private circle with an invite code.</p><button className="button primary" onClick={() => open('create')}>Create a public Samiti</button></div>}</div>}
    </> : view === 'loans' ? <>
      <div className="page-heading"><div><div className="eyebrow">COMMUNITY IS YOUR SUPERPOWER</div><h1>Loans & votes<span className="heading-dot">.</span></h1><p>A helping hand, backed by people who know you.</p></div><button className="button primary" onClick={() => open('loan')}><Plus size={17} /> Request a loan</button></div><div className="ledger-live"><span className={syncStatus.startsWith('Offline') ? 'offline' : ''} />{syncStatus}<small>Group votes refresh every 15 seconds</small></div>{focusedLoan && <button className="back-link" onClick={() => navigate('loans')}><ArrowLeft size={17}/> All loans & votes</button>}<div className="tabs loan-tabs">{['All requests', 'Needs your vote', 'My loans'].map(t => <button key={t} className={loanTab === t ? 'selected' : ''} onClick={() => { setLoanTab(t); if (focusedLoan) navigate('loans'); }}>{t}{t === 'Needs your vote' && <span>{pendingVotes.length}</span>}</button>)}</div><div className="loan-grid">{visibleLoans.map(l => <LoanCard userId={userId} busy={busy} action={action} key={l.id} loan={l} />)}</div>{!visibleLoans.length && <div className="panel empty"><CheckCircle2 size={36} /><h3>{focusedLoan ? 'This loan is unavailable' : loanTab === 'My loans' ? 'A little support for your next step' : 'You’re all caught up'}</h3><p>{focusedLoan ? 'Go back to see the loans you can access.' : loanTab === 'My loans' ? 'Request a loan from your Samiti and let your community weigh in.' : 'There are no requests waiting here right now.'}</p>{loanTab === 'My loans' && <button className="button primary" onClick={() => open('loan')}>Request a loan</button>}</div>}
    </> : <>
      <h1 className="sr-only">Wallet</h1><section className="wallet-summary purple"><div><span>Your savings across all Samitis</span><h2>{appearance.hideBalance?'••••':money(mySavings)} <small>NIM</small><button className="balance-privacy" aria-label={appearance.hideBalance?'Show balances':'Hide balances'} onClick={()=>updateAppearance({...appearance,hideBalance:!appearance.hideBalance})}>{appearance.hideBalance?<EyeOff size={17}/>:<Eye size={17}/>}</button></h2><p>+ {appearance.hideBalance?'••••':money(myInterest)} NIM in allocated interest</p></div><button className="wallet-card-connect" onClick={() => open('wallet')}><Wallet size={24} strokeWidth={1.8} /><span>{wallet ? 'Manage wallet' : 'Connect Nimiq'}</span></button></section><div className="section-heading"><h2>Your contribution schedule</h2><span>Monthly · due on the 10th</span></div><ContributionSchedule groups={groups} userId={userId} open={open} download={downloadReminder} /><div className="info-note"><CalendarDays size={20} /><span>Demo Auto Pay checks due plans daily at 9:00 am IST. Real Nimiq payments still require your wallet approval.</span></div><>{receipts.length > 0 && <><div className="section-heading"><h2>Testnet submission receipts</h2><span>Not settlement confirmations</span></div><section className="panel receipt-list">{receipts.map(p => <div className="receipt-row" key={p.hash}><div><strong>{p.groupName} · {money(p.amount)} NIM</strong><span>Submitted · unverified · testnet</span></div><code>{p.hash}</code><p>Receiving address: {p.recipient}. This receipt has not credited your savings.</p></div>)}</section></>}</><div className="section-heading"><h2>All activity</h2><span>Sample ledger · NIM</span></div><section className="panel"><ActivityLedger items={activities} limit={1000} /></section>
    </>}
    {view !== 'overview' && <footer className="page-footer"><span><Sprout size={14} /> Made for your circle.</span><span>Powered by community. Built with Nimiq.</span><button onClick={() => open('help')}>A little help <ArrowUpRight size={12} /></button></footer>}
    </>}
    </div></main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.map((n,i) => <span className="mobile-nav-slot" key={n.id}>{i===2&&<button className="nav-contribute" aria-label="Quick contribution" onClick={()=>open('contribute',dueGroups[0]?.id)}><Plus size={25}/></button>}<button aria-current={view===n.id?'page':undefined} className={view === n.id ? 'active' : ''} onClick={() => navigate(n.id)}><span><n.Icon size={21} />{n.id === 'loans' && pendingVotes.length > 0 && <i>{pendingVotes.length}</i>}</span><small>{n.id === 'loans' ? 'Loans' : n.id === 'overview' ? 'Home' : n.id === 'wallet' ? 'Wallet' : 'Samitis'}</small></button></span>)}</nav>
    {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
    {modal && <SamitiModal key={modal} receipt={receipt} reviewLoan={reviewLoan} modal={modal} appearance={appearance} onAppearanceChange={updateAppearance} state={state} targetGroup={targetGroup} setModalGroup={setModalGroup} setModal={setModal} busy={busy} setBusy={setBusy} formError={formError} setFormError={setFormError} setToast={setToast} wallet={wallet} setWallet={setWallet} inviteCode={inviteCode} setInviteCode={setInviteCode} action={action} pendingVotes={pendingVotes} dueGroups={dueGroups} open={open} />}
  </div>;
}
