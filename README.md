# Digital Samiti on Vercel

Production: https://digital-samiti.vercel.app

This target preserves the mobile UI, transparent vote ledgers, group contributions, lending simulations, invitations, and demo Auto Pay. It uses Next.js 16, persistent Neon Postgres, Managed Better Auth email/password sign-in, and Vercel Cron.

The original owner-private Sites deployment remains separate, including its data. Its private identity/service headers are not accepted as authentication on Vercel. Anonymous demo sessions use hashed, opaque bearer cookies independent of member IDs. Signed-in identity comes from Managed Better Auth.

Required server-only environment variables: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and `CRON_SECRET`. They are configured in Vercel; local values are in ignored `.env.local`. Never commit them. Database schema is in `migrations/001_samiti.sql`. The project uses the free Neon organization and 0.25 CU compute.

```powershell
npm ci
npm run dev
npm run build
node scripts/check-runtime.mjs http://localhost:3000
vercel deploy --prod --yes --archive=tgz
```

The runtime check creates isolated sample sessions and uses the local cron secret for its scheduler access check. It checks durable contributions, reload persistence, duplicate prevention, membership, spoofed identity-header rejection, vote audit, Auto Pay lifecycle, sign-in requirements, cron protection, and the auth session endpoint. It passed against the production alias on 5 November 2026. Actual signup/email delivery was not exercised by the agent.

The Vercel cron expression is `30 3 * * *` (nominally 9:00 am IST), with the bearer credential supplied through `CRON_SECRET`. Only demo contributions are processed; no real-wallet debit mandate, custody, or live lending is enabled.

Deployment: `dpl_ALJC8XVUb1vr92ayLQVSG72GoW2L` (production, Ready).


## Reference-inspired UI update · 5 November 2026

Warm cream and pastel cards, original SVG piggy-bank and action illustrations, savings goal rings, and a central contribution action refresh the mobile experience. Forms retain bottom-sheet motion, swipe dismissal and keyboard viewport handling. Tablet hero cards stack to use the narrower sidebar layout.

Device preferences include peach/lavender/mint themes, compact group cards and hidden savings/interest totals. Activity filters support type and rolling date ranges; Samitis support search and sorting. Loan forms show simple-interest repayment estimates and amount presets. Auto Pay and invitation sheets let members switch groups. Hash navigation supports browser back and direct links to the main views and group details.

Validation: TypeScript and the production build passed. Browser checks covered 320px/390px mobile and 768px/1440px layouts, preference persistence, loan estimates, group search/sorting, activity empty/reset states, Auto Pay group selection, named voting ledgers and back navigation. The existing runtime suite passed locally and against production. No real wallet approvals or debits were performed. Preview: `outputs/polished-mobile.jpg`.


## One-screen Home and Wallet update · 6 November 2026

Home shows the balance, next contribution, quick actions, and two stats. Samitis and activity remain in their dedicated tabs. Wallet starts with the savings card, with Connect Nimiq inside it. Verified the Home fit in 48 portrait viewport sizes locally, checked the live layout at 320 × 568 and 390 × 800, and opened the live wallet connection sheet without requesting a wallet approval.
