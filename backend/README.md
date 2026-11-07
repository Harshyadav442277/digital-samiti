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

Requests support the existing `{ action, requestId, ...fields }` contract. Bootstrap also accepts `{ action: 'bootstrap' }`. Every other action requires a UUID request ID. Member writes use versioned atomic updates with retries. Duplicate contribution requests with the same ID return the existing state. Create retries reuse the request ID as the group ID. Group creation uses Atlas transactions. Bootstrap leaves empty accounts unchanged. Start-demo creates a new isolated guest session with zero groups and balances. Guest-created groups are private practice circles and cannot be joined by other accounts.

## Validation

```powershell
npm test
npm run build
```

Integration tests connect to the configured Atlas cluster, create a uniquely named temporary test database and remove only that database afterward. They check concurrent contribution retries, authorization, privacy, audited voting, loan repayments, invitation handling, persistence, scheduler protection and input rejection.

For the complete frontend route flow, start both servers and run `node scripts/check-journeys.mjs http://localhost:3017` from the application root.

## Hosting and data

### Vercel

The backend also includes a serverless entry that reuses its MongoDB connection pool across warm requests. From the application root, prepare the deployment artifact:

```powershell
node backend/scripts/prepare-vercel.mjs
cd outputs/express-vercel
vercel link --project digital-samiti-api --scope wukong4 --yes
vercel deploy --prod --scope wukong4 --yes
```

Configure `MONGODB_URI`, `MONGODB_DB`, `SAMITI_API_SECRET`, `CRON_SECRET`, and `COOKIE_SECURE=true` in the backend project's private production environment. Configure `SAMITI_API_URL=https://digital-samiti-api.vercel.app` and the matching service secret in the frontend project. The scheduler credential must match on both projects. Atlas must accept the hosting service's outbound network connections before promoting the frontend deployment.

`outputs/express-vercel` contains bundled application code and dependency metadata. Credential files are excluded from the artifact upload. The checked-in Node server entry remains available for conventional hosting.

### Preserving existing Postgres data

`node backend/scripts/import-postgres.mjs <private-production-env-file>` copies groups and unexpired hashed guest sessions into MongoDB. The environment file supplies the existing `DATABASE_URL`, while `backend/.env` supplies Atlas configuration. The importer inserts missing records, verifies group contents, and stops if an existing MongoDB group differs. It never overwrites an existing MongoDB ledger or deletes Postgres records. Run the importer before switching traffic. Reconcile any subsequent Postgres writes before promoting the frontend.

### Conventional Node hosting

Deploy this service on a Node.js host with access to Atlas. Set its environment secrets privately, use `HOST=0.0.0.0`, the host's assigned `PORT`, and `COOKIE_SECURE=true` behind HTTPS. Configure the Atlas network allowlist for that host. Set the Next.js `SAMITI_API_URL` to the service's HTTPS origin and use the same `SAMITI_API_SECRET` on both services. Both services also need the same `CRON_SECRET`. Start with `npm ci`, `npm run build` and `npm start` inside `backend/` from the repository checkout.

The initial local database started as a new dataset. Before production cutover on 7 November 2026, the separate import script copied and verified 64 Postgres groups and retained 37 unexpired guest sessions. Email/password sign-in continues through Neon Auth. The Vercel frontend is now configured to use the hosted Express service. The owner approved an Atlas `0.0.0.0/0` network entry for the deployment, with database credentials still required.

All balances, lending and automatic contributions use demo funds. Testnet hashes remain unverified receipts and do not credit savings.
