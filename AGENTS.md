# Local project instructions

Digital Samiti's Vercel frontend uses Next.js and Managed Better Auth. Ledger storage uses
the Node.js/Express MongoDB backend when SAMITI_API_URL is configured; otherwise it uses
the existing Neon Postgres backend. See backend/README.md for setup and hosting.
Keep SAMITI_API_SECRET server-only. Express accepts verified member identity only from
the authenticated Next.js server. Never pass browser-supplied identity headers through.
This public deployment must never trust Sites identity headers or Sites service bypass credentials.
The Auto Pay cron requires its own CRON_SECRET. Preserve group membership checks and hashed guest sessions.
All financial flows remain demo/testnet only. No wallet approvals or real debits during agent testing.
The original Cloudflare/Sites target lives in ../digital-samiti and is a separate deployment with separate data.

Read the existing [project instructions](../CLAUDE.md) and respect their stated scope
and child overrides before making project changes.

<!-- shared-product-shipping:start -->
## Shared app and website shipping guide

For planning, building or shipping the requested public app/website, including SEO/ASO,
read the relevant sections of the shared [shipping guide](../../verified_seo_aso_agent_handoff.md); [source verification](../../SEO_ASO_VERIFICATION.md); [product shipping template](../../templates/PRODUCT_SHIPPING_TEMPLATE.md).
These are local workspace references to one canonical guide in the Hackathons folder.
Use existing product facts and authorizations; keep all project-specific scope, event,
research, privacy, signing and publication rules. This connection does not resume a
stopped project or authorize installation, spending, account linking, outreach or release.
For private dashboards, APIs or services, apply only relevant documentation and user-flow
guidance. If a shared file is inaccessible, report the exact path and continue independent
authorized work; do not invent its contents or treat unavailable data as verified.
<!-- shared-product-shipping:end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
