# PlanningSup (AGENTS)

Uni calendar PWA + API (ICS→events) with offline + auth prefs sync.

## Fast (root)
- Setup: `bun install`
- API env: `cp apps/api/.env.example apps/api/.env` (needs `DATABASE_URL`)
- Dev: `bun dev`
- Quality: `bun run lint-fix && bun run lint && bun run typecheck && bun run test:unit`
- Docker smoke: `bun run docker:build` (Dockerfile runs lint/typecheck/build/test:unit)
- Integration: `bun run test:integration[:local]` / `bun run test:integration:auth` (20001)
- E2E: `bun run test:e2e[:safari|:headed|:debug]`
- DB/auth changed: `cd apps/api && bun run generate-drizzle && bun run generate-better-auth`

## Workspaces / Bun
- Workspaces: `apps/*`, `packages/*`, `test`.
- Root scripts fan-out via `scripts/run.ts` (excludes `apps/app`, `apps/extension`).
- Per-workspace: `cd <workspace> && bun run <script>` (needed for `apps/extension`).
- No colon-namespaced commands: `bun run typecheck:web`, `bun run lint:web`, etc. do NOT exist. Use `cd apps/web && bun run typecheck` instead.
- Use Bun only; `.bun-version` + `bun.lock`; `bunx --bun <cli>`; `bun run <script> -- <flags>`.
- Tests: `bun test` for `*.test.ts`; Playwright for `test/e2e/*.spec.ts`.
- End-to-end typed API: use Eden treaty client `packages/libs/src/client/index.ts` (`client.api.*`), avoid ad-hoc `fetch('/api/...')`.

## CI / Docker / ports
- Workflows: `.github/workflows/docker-publish.yml`, `.github/workflows/extension-build.yml`; validate: `bun run validate:workflows`.
- `docker-publish.yml`: build→integration (auth off/on)→optional e2e on UI changes→publish only on whitelist branches or `vX.Y.Z` (no fork PR publish).
- DB: Postgres (Docker Compose).
- Ports: `api=20000 web=4444 pg=5432 testpg=5433 auth=20001 authpg=5434`.

## Key paths
- Orchestrators: `scripts/run.ts`, `scripts/test*.ts`, `scripts/validate-workflows.ts`
- API: `apps/api/src/**`, `apps/api/drizzle.config.ts`, `apps/api/drizzle/*.sql`
- Auth/prefs sync: `apps/web/src/composables/useUserPrefsSync.ts` ↔ `apps/api/src/utils/auth.ts` ↔ `apps/api/src/db/schemas/auth.ts`
- Web: `apps/web/src/**`, `apps/web/vite.config.*`
- Extension: `apps/extension/**`
- Shared: `packages/libs/**`, `packages/config/**`
- Data: `resources/plannings/*.json` (validate via `scripts/check-plannings-json.js`)
- Tests: `test/*.test.ts`, `test/integration/*.test.ts`, `test/e2e/*.spec.ts`

## API notes (bun:sql + Drizzle)
- DB: `import { SQL } from 'bun'` + `drizzle-orm/bun-sql`; `db.execute(...) => Row[]`.
- Prefer Drizzle query builder; use raw SQL only when needed (PG-specific/atomic patterns).
- Migrations on boot unless `NO_MIGRATE_DATABASE=true`.
- `refreshedAt`: network=`Date.now()`; db=`plannings_backup.updated_at`.
- `/api/ops/plannings`: `x-ops-token` must match `OPS_TOKEN` (prod: 404 if missing/invalid).
- Jobs: `RUN_JOBS=false`, `ALLOWED_JOBS`, `JOBS_QUIET_HOURS*`.
- Routes (current): `/api/ping`, `/api/plannings`, `/api/plannings/:fullId?events=true[&onlyDb=true]`, `/api/ops/plannings`, `/api/auth/*`, `/api/auth/auto-redirect/:provider`, `/config.js`.
