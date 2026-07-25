# Deployment (Phase 8)

## 1. Vercel (app hosting)

Import the repo into Vercel. Build command stays the default (`next build`) —
schema migrations are deliberately **not** hooked into the Vercel build (see
§3); Vercel only ever builds and serves application code.

Set these as Vercel **Project → Settings → Environment Variables** (values
from Supabase Project Settings → API/Database, Cloudflare R2 dashboard, and
your AI provider):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only, never exposed to the client |
| `DATABASE_URL` | Supavisor pooled connection string, port 5432, session mode |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `GEMINI_API_KEYS` | comma-separated, rotated on rate-limit |
| `ANTHROPIC_API_KEY` | optional paid upgrade path, not required |

## 2. GitHub Actions secrets

`.github/workflows/*.yml` need the same values as **repository secrets**
(Settings → Secrets and variables → Actions):

- All the Vercel ones above (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `GEMINI_API_KEYS`)
- `DEPLOYED_URL` — the production URL (e.g. `https://vietmealfit.vercel.app`), used only by the keep-alive ping

`ci.yml`'s `integration-tests` job skips on PRs from forks (no secrets there
by design) but always runs on `push` to `main` and on PRs from this repo.

## 3. Schema migrations

Historically (Phases 0–7) the schema was pushed directly with
`drizzle-kit push` — there was no `server/db/migrations/` folder and no
migration history. Phase 8 added real migrations:

- `npm run db:generate` — diffs `server/db/schema.ts` against the migration
  history and writes a new `server/db/migrations/NNNN_*.sql` file. No DB
  connection needed. Run this after every schema change, commit the result.
- `npm run db:migrate` — applies pending migrations. **Not** `drizzle-kit
  migrate` — that CLI command hangs against this project's Supavisor pooler
  even though a plain `postgres.js` connection with the identical
  `DATABASE_URL` succeeds reliably (a real, reproduced finding — see
  `scripts/apply-migration-manual.mjs`'s original comment). `scripts/migrate.mjs`
  is the fix: it calls `drizzle-orm`'s migrator function directly, with the
  same connection config (`prepare: false, ssl: "require"`) already proven to
  work everywhere else in this app.
- `server/db/migrations/0000_wet_spyke.sql` is a **baseline**, generated in
  Phase 8 from the schema that already existed live. It must never actually
  run (it would `CREATE TABLE` on objects that already exist).
  `scripts/stamp-baseline-migration.mjs` marks it as already-applied by
  seeding `drizzle.__drizzle_migrations` with its hash directly, without
  executing its SQL. It's idempotent (checks before inserting), so
  `.github/workflows/migrate.yml` runs it before every `db:migrate` — a no-op
  after the first time.

`.github/workflows/migrate.yml` runs on every push to `main` that touches
`server/db/schema.ts` or `server/db/migrations/**`, applying migrations to
prod *before* Vercel's own build of the same commit goes live.

## 4. Keep-alive (free-tier pause mitigation)

Supabase free-tier projects auto-pause after 7 days with no API activity.
`.github/workflows/keepalive-backup.yml` hits `GET /api/health` (which runs a
real `select 1` through the app's own DB client — the actual path, not a
side-channel) every 3 days via `schedule:` cron, plus `workflow_dispatch` for
a manual trigger.

## 5. Backups

Free-tier Supabase has no automatic backup/PITR. The same scheduled workflow
runs `scripts/backup-db.mjs`: dumps every table in the `public` schema to one
gzipped JSON file, uploads it to the existing R2 bucket under `backups/`
(dated filenames, e.g. `backups/2026-07-25.json.gz`), and deletes anything
older than 30 days.

**To restore:** download the object from R2, `gunzip`, `JSON.parse`, and
`INSERT`/upsert rows back per table (respecting FK order — `profiles` before
anything referencing it, etc.). This is a logical (row-data) backup, not a
`pg_dump`-restorable binary — intentional, since it needs zero extra tooling
(no `pg_dump` binary, no separate Postgres instance) beyond what's already in
this repo.

## 6. Error monitoring

`instrumentation.ts` exports `onRequestError`, which structured-logs every
server error (`console.error`) — Vercel's free-tier Runtime Logs already
captures and makes these searchable, so this is zero-setup, zero-cost
monitoring by default, matching the same free-tier-first philosophy as the AI
provider abstraction (`server/ai/provider.ts`). `app/error.tsx` and
`app/global-error.tsx` give real users a recoverable fallback UI instead of a
blank crash.

Upgrade path if real APM is ever wanted: forward `err`/`request`/`context`
from `onRequestError` to a provider (e.g. Sentry) behind an env var, the same
optional-upgrade pattern already used for `ANTHROPIC_API_KEY`. Not wired up
by default — no account/DSN to gate it on yet.

## 7. What's intentionally not in CI

`npm run test:e2e` is not run in GitHub Actions. Phase 7's E2E suite drives a
real sign-in flow against one fixed, recreated-on-every-run Supabase test
user (`tests/e2e/global-setup.ts`) — safe for one local run at a time, but
concurrent CI runs (e.g. two PRs building at once) would race on that same
user. Run `npm run test:e2e` locally before merging changes that touch
user-facing flows; unit + integration tests (which don't share mutable global
state) do run in `ci.yml` on every PR.
