# Digital Samiti API

Node.js 22+ and Express 5 API using MongoDB Atlas. It stores Samitis, membership, the demo financial ledger, immutable vote records, personal Auto Pay plans and hashed guest sessions. Financial operations reuse the frontend project's domain rules.

The Next.js app authenticates members using its existing Neon Auth session, then forwards their verified identity to Express over a server-only authenticated connection. Express requires `SAMITI_API_SECRET` before accepting identity headers. Browser requests use the same-origin Next.js routes. The service credential must stay out of client bundles.

## Local setup

From the application root:

```powershell
cd backend
npm ci
node scripts/setup-local.mjs "C:/path/to/atlas-credentials.env"
npm run build
npm start
```

The setup script reads `MONGODB_URI`, `MONGODB_USERNAME` and `MONGODB_PASSWORD` as environment data. It writes an ignored `backend/.env`, using the `digital_samiti` database. You can also copy `.env.example` to `.env` and supply your own settings.

In another terminal, connect the frontend:

```powershell
cd backend
node scripts/connect-frontend.mjs
```

Restart the backend after this step to reload the shared cron credential. Then run `npm run dev -- --port 3017` from the application root. The frontend's ignored `.env.local` holds `SAMITI_API_URL` and `SAMITI_API_SECRET`. Requests to `/api/samiti` and the protected scheduler route will use Express when `SAMITI_API_URL` is set. Removing that setting selects the existing Postgres implementation.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Database readiness with no credentials or account data |
| GET | `/api/samiti` | Current member's groups and public group summaries |
| POST | `/api/samiti` | Bootstrap, create, join, contribute, request a loan, vote, repay, manage demo Auto Pay and save unverified testnet receipts |
| GET or POST | `/api/autopay/run` | Process due demo plans, requiring the separate cron credential |

All API endpoints require `Authorization: Bearer <SAMITI_API_SECRET>`. Only the trusted frontend server adds `x-samiti-user-id` and the URI-encoded `x-samiti-user-name` after validating a signed-in session. Guest access uses an opaque, HttpOnly cookie whose hash is stored with an expiration date. The runner additionally requires `x-samiti-cron-authorization: Bearer <CRON_SECRET>`.

Requests support the existing `{ action, requestId, ...fields }` contract. Bootstrap also accepts `{ action: 'bootstrap' }`. Every other action requires a UUID request ID. Member writes use versioned atomic updates with retries. Duplicate contribution requests with the same ID return the existing state. Create retries reuse the request ID as the group ID. Group creation and initial sample groups use Atlas transactions.

## Validation

```powershell
npm test
npm run build
```

Integration tests connect to the configured Atlas cluster, create a uniquely named temporary test database and remove only that database afterward. They check concurrent contribution retries, authorization, privacy, audited voting, loan repayments, invitation handling, persistence, scheduler protection and input rejection.

For the complete frontend route flow, start both servers and run `node scripts/check-journeys.mjs http://localhost:3017` from the application root.

## Hosting and data

Deploy this service on a Node.js host with access to Atlas. Set its environment secrets privately, use `HOST=0.0.0.0`, the host's assigned `PORT`, and `COOKIE_SECURE=true` behind HTTPS. Configure the Atlas network allowlist for that host. Set the Next.js `SAMITI_API_URL` to the service's HTTPS origin and use the same `SAMITI_API_SECRET` on both services. Both services also need the same `CRON_SECRET`. Start with `npm ci`, `npm run build` and `npm start` inside `backend/` from the repository checkout.

The MongoDB database is a new dataset. Existing Postgres groups are not copied by these setup scripts. Email/password sign-in continues through Neon Auth. Existing Vercel production settings must be updated separately after the Express service has been hosted and verified.

All balances, lending and automatic contributions use demo funds. Testnet hashes remain unverified receipts and do not credit savings.
