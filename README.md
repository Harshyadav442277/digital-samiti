# Digital Samiti on Vercel

Production: https://digital-samiti.vercel.app

This target preserves the mobile UI, transparent vote ledgers, group contributions, lending simulations, invitations, and demo Auto Pay. It uses Next.js 16, a Node.js/Express API with MongoDB Atlas, Managed Better Auth email/password sign-in, and Vercel Cron.

## Express and MongoDB backend

An optional Node.js/Express 5 API now stores the ledger in MongoDB Atlas. See [backend setup and API documentation](backend/README.md). Run `npm run backend:build` and `npm run backend:start` from this directory after installing the backend's dependencies and setting its private environment values. `npm run backend:test` runs integration tests against a temporary Atlas database.

The frontend uses Express when its server environment has `SAMITI_API_URL` and `SAMITI_API_SECRET`. Production is connected to the Express service at https://digital-samiti-api.vercel.app. On 7 November 2026, 64 existing Postgres groups and 37 unexpired hashed guest sessions were copied and verified in MongoDB before the frontend was promoted. Postgres source records were preserved. Email/password sessions continue through Neon Auth.

Validation on 7 November 2026 covered ten Atlas integration tests, six financial/progress regression tests, both builds, and contribution/voting/repayment persistence through the frontend API routes.

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

Deployment: `dpl_4ZWitDZyEgTqkbocwFqMZKM78JYd` (production, Ready).


## Reference-inspired UI update · 5 November 2026

Warm cream and pastel cards, original SVG piggy-bank and action illustrations, savings goal rings, and a central contribution action refresh the mobile experience. Forms retain bottom-sheet motion, swipe dismissal and keyboard viewport handling. Tablet hero cards stack to use the narrower sidebar layout.

Device preferences include peach/lavender/mint themes, compact group cards and hidden savings/interest totals. Activity filters support type and rolling date ranges; Samitis support search and sorting. Loan forms show simple-interest repayment estimates and amount presets. Auto Pay and invitation sheets let members switch groups. Hash navigation supports browser back and direct links to the main views and group details.

Validation: TypeScript and the production build passed. Browser checks covered 320px/390px mobile and 768px/1440px layouts, preference persistence, loan estimates, group search/sorting, activity empty/reset states, Auto Pay group selection, named voting ledgers and back navigation. The existing runtime suite passed locally and against production. No real wallet approvals or debits were performed. Preview: `outputs/polished-mobile.jpg`.


## One-screen Home and Wallet update · 6 November 2026

Home shows the balance, next contribution, quick actions, and two stats. Samitis and activity remain in their dedicated tabs. Wallet starts with the savings card, with Connect Nimiq inside it. Verified the Home fit in 48 portrait viewport sizes locally, checked the live layout at 320 × 568 and 390 × 800, and opened the live wallet connection sheet without requesting a wallet approval.

## MongoDB production deployment � 7 November 2026

Backend deployment `dpl_4A8cQMydVF1EFJoHLjzt3KZ3aRBq` and frontend deployment `dpl_4ZWitDZyEgTqkbocwFqMZKM78JYd` are live. The public health endpoint reports a connected database. Production checks verified contribution and repayment persistence directly in Atlas, duplicate protection, rejection of forged browser identity, and scheduler authorization. The owner approved the Atlas `0.0.0.0/0` IP access entry required for this Vercel setup. Database authentication remains required.
