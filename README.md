# VietMealFit

Personalized meal planning, exercise routines, and Vietnamese nutrition data —
a full-stack rebuild of an HCI research prototype. Next.js (App Router) +
tRPC + Drizzle + Postgres (Supabase) + Cloudflare R2, deployed on Vercel.

## Getting started

```bash
cp .env.example .env.local   # fill in Supabase/R2/AI credentials
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | standard Next.js |
| `npm run lint` | ESLint |
| `npm run test` / `test:unit` / `test:integration` / `test:e2e` | Vitest (unit + integration) and Playwright (E2E) — see `plan/vietmealfit_technical_plan.md` §7 |
| `npm run db:generate` | diff `server/db/schema.ts` against migration history, write a new migration file |
| `npm run db:migrate` | apply pending migrations |
| `npm run db:studio` | Drizzle Studio |

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for environment variables, CI/CD,
schema migrations, keep-alive, backups, and error monitoring.
