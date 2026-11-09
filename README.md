# Digital Samiti on Vercel

Production: https://digital-samiti.vercel.app

This target uses Next.js 16, Nimiq Pay wallet sign-in, a Node.js/Express API with MongoDB, and Vercel Cron. It separates mainnet contributions from the guest demo ledger.

Wallet Samitis can invite members before linking a receiving address. The owner proposes the address from Nimiq Multisig and selects a co-signer who has joined the Samiti. Only that member can confirm the proposal. Existing wallet Samitis and replacement addresses require confirmation before starting new contributions. In-flight contributions can still be verified against their original recipient. Signers review the address in Nimiq Multisig and approve payouts there.

## Express and MongoDB backend

An optional Node.js/Express 5 API now stores the ledger in MongoDB Atlas. See [backend setup and API documentation](backend/README.md). Run `npm run backend:build` and `npm run backend:start` from this directory after installing the backend's dependencies and setting its private environment values. `npm run backend:test` runs integration tests against a temporary Atlas database.

The frontend uses Express when its server environment has `SAMITI_API_URL` and `SAMITI_API_SECRET`. Production is connected to the Express service at https://digital-samiti-api.vercel.app. On 7 November 2026, 64 existing Postgres groups and 37 unexpired hashed guest sessions were copied and verified in MongoDB before the frontend was promoted. Postgres source records were preserved.

Validation on 7 November 2026 covered ten Atlas integration tests, six financial/progress regression tests, both builds, and contribution/voting/repayment persistence through the frontend API routes.

The original owner-private Sites deployment remains separate, including its data. Anonymous demo sessions use hashed, opaque bearer cookies independent of member IDs. The wallet identity comes from a server-verified signature over a short-lived, single-use challenge.

Set `SAMITI_WALLET_SECRET` to a random secret of at least 32 characters and set a separate `CRON_SECRET`. With Express, set `SAMITI_API_URL` and `SAMITI_API_SECRET` on Next.js. With Postgres, set `DATABASE_URL` and apply the SQL files in `migrations/` in order. Keep local secrets in ignored `.env.local`.

```powershell
npm ci
npm run dev
npm run build
node scripts/check-runtime.mjs http://localhost:3000
```

The runtime check creates isolated demo sessions and verifies demo persistence, duplicate prevention, cron protection, and wallet sign-in using a generated test key.

The Vercel cron expression is `30 3 * * *` (nominally 9:00 am IST), with the bearer credential supplied through `CRON_SECRET`. Only demo contributions are processed; no real-wallet debit mandate, custody, or live lending is enabled.

Deployment: `dpl_4ZWitDZyEgTqkbocwFqMZKM78JYd` (production, Ready).


## Reference-inspired UI update · 5 November 2026

Warm cream and pastel cards, original SVG piggy-bank and action illustrations, savings goal rings, and a central contribution action refresh the mobile experience. Forms retain bottom-sheet motion, swipe dismissal and keyboard viewport handling. Tablet hero cards stack to use the narrower sidebar layout.

Device preferences include peach/lavender/mint themes, compact group cards and hidden savings/interest totals. Activity filters support type and rolling date ranges; Samitis support search and sorting. Loan forms show simple-interest repayment estimates and amount presets. Auto Pay and invitation sheets let members switch groups. Hash navigation supports browser back and direct links to the main views and group details.

Validation: TypeScript and the production build passed. Browser checks covered 320px/390px mobile and 768px/1440px layouts, preference persistence, loan estimates, group search/sorting, activity empty/reset states, Auto Pay group selection, named voting ledgers and back navigation. The existing runtime suite passed locally and against production. No real wallet approvals or debits were performed. Preview: `outputs/polished-mobile.jpg`.


## One-screen Home and Wallet update · 6 November 2026

Home shows the balance, next contribution, quick actions, and two stats. Samitis and activity remain in their dedicated tabs. Wallet starts with the savings card, with Connect Nimiq inside it. Verified the Home fit in 48 portrait viewport sizes locally, checked the live layout at 320 × 568 and 390 × 800, and opened the live wallet connection sheet without requesting a wallet approval.

## MongoDB production deployment · 7 November 2026

Backend deployment `dpl_4A8cQMydVF1EFJoHLjzt3KZ3aRBq` and frontend deployment `dpl_4ZWitDZyEgTqkbocwFqMZKM78JYd` are live. The public health endpoint reports a connected database. Production checks verified contribution and repayment persistence directly in Atlas, duplicate protection, rejection of forged browser identity, and scheduler authorization. The owner approved the Atlas `0.0.0.0/0` IP access entry required for this Vercel setup. Database authentication remains required.

## Empty startup and demo

The startup page offers Sign in with Nimiq Pay and Start an empty demo. New members start with no Samitis, balances, or transactions. Each fresh demo receives an isolated guest session and can create private practice Samitis. All demo payments use the sample ledger.

## Wallet workspace and mainnet contributions

Open the app inside an up-to-date Nimiq Pay app on Mainnet. Sign-in requests account sharing and message approval. The first verified sign-in opens a new wallet workspace. Legacy email accounts and their simulated groups stay under their original identities. A wallet sign-in opens a separate ledger.

Set `NIMIQ_MAINNET_RPC_URL` on Express when using MongoDB, or on Next.js when using Postgres. Use an HTTPS Nimiq Mainnet history node with the transaction index enabled. If it requires credentials, set `NIMIQ_MAINNET_RPC_AUTH` to the full Authorization header value. The server checks node readiness before opening a payment. It credits contributions after verifying a successful, finalized mainnet transfer with the expected signer, destination, amount, and contribution reference.

Choose a dedicated receiving wallet controlled by the group. The ledger records confirmed contributions, and whoever controls the receiving wallet can spend the funds. To verify a pending payment, use its transaction hash from Nimiq Pay history. Mainnet lending and automatic debits are unavailable.

Deploy the updated Express service before the Next.js frontend when using MongoDB. Wallet sign-in requires the new protected challenge endpoint.
