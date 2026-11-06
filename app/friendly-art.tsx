'use client';
import { useId } from 'react';

export function PiggyBank() {
  const id=useId().replace(/:/g,'');
  return <svg viewBox="0 0 280 245" fill="none" role="img" aria-label="A cheerful pink piggy bank saving a Nimiq coin">
    <defs><linearGradient id={`${id}-body`} x1="80" y1="70" x2="210" y2="208" gradientUnits="userSpaceOnUse"><stop stopColor="#FFE4E5"/><stop offset=".45" stopColor="#F4B6C5"/><stop offset="1" stopColor="#DC8FA8"/></linearGradient><linearGradient id={`${id}-snout`} x1="160" y1="139" x2="218" y2="192" gradientUnits="userSpaceOnUse"><stop stopColor="#F6B4C0"/><stop offset="1" stopColor="#E493AA"/></linearGradient><linearGradient id={`${id}-coin`} x1="101" y1="7" x2="136" y2="66" gradientUnits="userSpaceOnUse"><stop stopColor="#FFE6A2"/><stop offset="1" stopColor="#F1B84E"/></linearGradient><filter id={`${id}-shadow`} x="0" y="0" width="280" height="245" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="5"/></filter></defs>
    <ellipse cx="147" cy="220" rx="85" ry="11" fill="#BA8B99" opacity=".13" filter={`url(#${id}-shadow)`}/>
    <g className="piggy-coin"><path d="M109 20C116 11 132 12 140 20L147 44C148 58 131 69 119 62L109 20Z" fill="#D59E43" stroke="#A97735" strokeWidth="1.5"/><ellipse cx="124" cy="34" rx="23" ry="29" transform="rotate(-17 124 34)" fill={`url(#${id}-coin)`} stroke="#D5A14F" strokeWidth="1.7"/><ellipse cx="124" cy="34" rx="17" ry="23" transform="rotate(-17 124 34)" stroke="#FFEDB7" strokeWidth="2"/><path d="M116 30L123 24L133 28L135 38L128 45L118 40L116 30Z" stroke="#BB883B" strokeWidth="2.4" strokeLinejoin="round"/></g>
    <path d="M69 135C48 129 44 149 54 152C65 156 65 140 56 140" stroke="#CF8C9F" strokeWidth="5" strokeLinecap="round"/>
    <path d="M102 183L100 211C105 224 122 224 128 211L132 194M175 186L181 211C187 220 200 217 204 208L201 177" fill="#D991A6" stroke="#C68199" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M67 144C62 108 89 79 129 77C165 74 211 96 221 132C234 176 205 205 153 206C100 208 71 184 67 144Z" fill={`url(#${id}-body)`} stroke="#CD8EA4" strokeWidth="2"/>
    <path d="M154 101C145 80 154 63 165 63C182 64 187 82 180 104" fill="#F6BACB" stroke="#C987A1" strokeWidth="2"/><path d="M163 88C158 79 160 72 166 72C173 72 178 82 174 91" fill="#DB91AC"/>
    <path d="M95 104C103 93 117 89 128 91" stroke="#FFE7EA" strokeWidth="6" strokeLinecap="round" opacity=".85"/>
    <path d="M118 94C126 91 140 93 148 97" stroke="#A86E88" strokeWidth="5" strokeLinecap="round"/>
    <ellipse cx="196" cy="159" rx="36" ry="27" transform="rotate(7 196 159)" fill={`url(#${id}-snout)`} stroke="#CD8A9F" strokeWidth="1.5"/><ellipse cx="186" cy="159" rx="4" ry="7" transform="rotate(7 186 159)" fill="#A56680"/><ellipse cx="205" cy="161" rx="4" ry="7" transform="rotate(7 205 161)" fill="#A56680"/>
    <ellipse cx="162" cy="133" rx="5" ry="8" transform="rotate(-8 162 133)" fill="#63475F"/><ellipse cx="164" cy="130" rx="1.7" ry="2.3" fill="#FFF6F0"/>
    <ellipse cx="143" cy="151" rx="10" ry="5" fill="#EAA0B5" opacity=".8"/><path d="M148 170C152 175 157 176 162 173" stroke="#B57490" strokeWidth="2" strokeLinecap="round"/>
    <path d="M79 198V207M74 203H84M225 75V87M219 81H231M64 75V81M61 78H67" stroke="#C2A0D7" strokeWidth="2.5" strokeLinecap="round"/><circle cx="213" cy="44" r="3" fill="#E8C887"/><circle cx="52" cy="115" r="3" fill="#C9D8BA"/>
  </svg>;
}

export function ActionArt({type}:{type:'save'|'autopay'|'loan'|'invite'}) {
  const base={fill:'none',stroke:'#6D5765',strokeWidth:2.3,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
    {type==='save'&&<g {...base}><path d="M10 26L44 19L52 26L47 49L15 53L10 26Z" fill="#D4B9ED"/><path d="M10 26L43 25L49 31L47 49L15 53L10 26Z" fill="#BFA0DF"/><path d="M19 24L15 10L37 6L41 23" fill="#F7D57C"/><path d="M22 20L21 13L33 11L35 21" stroke="#C59944"/><path d="M37 32L53 31L55 42L39 44L37 32Z" fill="#EFE0FA"/><circle cx="44" cy="38" r="2" fill="#8F73AB" stroke="none"/><path d="M15 32L17 46" stroke="#DAC8EE"/></g>}
    {type==='autopay'&&<g {...base}><path d="M11 17L46 14L53 47L17 52L11 17Z" fill="#C5E0E5"/><path d="M11 17L46 14L48 26L13 29L11 17Z" fill="#99C4D0"/><path d="M20 11L21 23M37 9L39 21" strokeWidth="4"/><path d="M24 36L30 34L27 43M35 34L42 33L38 43" stroke="#688B98"/><circle cx="47" cy="46" r="12" fill="#FFF3CF"/><path d="M42 43C45 39 50 40 52 44M52 40V44H48M51 49C48 53 43 51 41 48M41 52V48H45" stroke="#B19457" strokeWidth="1.8"/></g>}
    {type==='loan'&&<g {...base}><path d="M10 40L22 29L37 30L43 35L51 29C56 25 60 31 56 35L41 49L24 51L12 57L6 46L10 40Z" fill="#E6BBAD"/><path d="M23 34L35 34C43 33 43 40 36 41L25 42"/><circle cx="32" cy="18" r="13" fill="#FFE099"/><path d="M27 15L32 12L37 15V21L32 24L27 21V15Z" stroke="#B78E49"/><path d="M13 12V5M9 8H17M51 16V9M47 12H55" stroke="#D8BACA" strokeWidth="2"/></g>}
    {type==='invite'&&<g {...base}><path d="M10 23L34 8L55 26L49 50L15 49L10 23Z" fill="#B9CBA3"/><path d="M10 23L30 37L55 26L49 50L15 49L10 23Z" fill="#D6E4C4"/><path d="M16 48L30 37L49 49" stroke="#9CAF85"/><path d="M25 18H42V35H25Z" fill="#FFF7E7"/><path d="M33 23V31M29 27H37" stroke="#B997C9" strokeWidth="2.5"/><path d="M7 13V7M4 10H10M53 11V5M50 8H56" stroke="#D8BACA" strokeWidth="2"/></g>}
  </svg>;
}

export function GoalRing({value,children}:{value:number;children:React.ReactNode}) {
  const pct=Math.min(100,Math.max(0,value));
  return <span className="goal-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" className="ring-track"/><circle cx="50" cy="50" r="43" className="ring-fill" strokeDasharray={`${pct*2.702} 270.2`}/></svg><span className="ring-art">{children}</span><span className="ring-badge">{Math.round(pct)}%</span></span>;
}
