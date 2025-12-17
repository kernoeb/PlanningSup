# Repository Guidelines

## Overview
PlanningSup is a french university calendar to help students manage their schedules. It features a PWA with offline support, automatic refresh, and customization options. The backend API serves calendar data converted from ICS.

## Project Structure & Modules
- Monorepo with Bun workspaces: `apps/` (API in `apps/api` on Elysia + Drizzle/PostgreSQL; PWA in `apps/web` on Vue 3 + Vite + DaisyUI (Tailwind CSS); desktop and mobile in `apps/app`; browser extension in `apps/extension`) and shared `packages/` (`libs` for lint/TS utilities, `config` for Vite/TS presets).  
- Tests live in `test/`: unit `*.test.ts`, integration in `test/integration/`, Playwright specs in `test/e2e/`. Shared assets and ICS metadata are in `resources/`. Root docker-compose files drive local and CI stacks.

## Build, Test & Dev Commands
- Install: `bun install` (Bun pinned in `.bun-version`, equivalent to Node >=22).  
- Local stack: `bun dev` (starts Docker, then `scripts/run dev`).  
- Build: `bun run build`.  
- Unit sweep: `bun run test:unit`  
- Integration: `bun run test:integration` (builds image) or `bun run test:integration:local` with existing containers.  
- E2E: `bun run test:e2e` (`:safari`, `:headed`, `:debug` variants).  
- Quality gates: `bun run lint`, `bun run lint-fix` (auto-fix most of the issues), `bun run typecheck`, `bun run coverage`.

## Coding Style & Naming
- 2-space indent, LF, UTF-8, final newline (`.editorconfig`).  
- ESLint extends `@antfu/eslint-config` with 1TBS braces, sorted JSON keys, and unused import warnings (`packages/libs/eslint.config.js`). Run lint before pushing.  
- TypeScript-first: camelCase for variables/functions, PascalCase for components/types, kebab-case for files/routes. Avoid top-level awaits; drop stray `console` calls in PRs.

## Testing Guidelines
- Bun test for unit/integration; Playwright for E2E (browsers auto-install).  
- Naming: unit/integration `*.test.ts`; E2E `*.spec.ts` run via Playwright scripts only.  
- Keep tests isolated: mock externals in unit tests, use Dockerized Postgres for integration, target `http://localhost:20000` with `docker-compose.test.yml` for E2E.  
- Keep suites lean (Bun timeout 30s in `bunfig.toml`); add regression assertions and descriptive `describe/it` titles.

## Commit & PR Guidelines
- Use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`); imperative subject, <72 chars.  
- Before a PR: run lint, typecheck, unit tests, and any integration/E2E affected.  
- PRs should include scope, linked issue, user impact, and screenshots/recordings for UI changes.  
- Keep diffs focused; call out env or migration changes and update docs/config samples alongside code.

## Environment & Secrets
- Use `.bun-version` and `.nvmrc` to align runtimes; Docker Compose is the source of truth for services, ports, and test URLs.

## API Notes (Bun SQL + Drizzle + routes)
- DB: Drizzle `bun-sql` (`bun:SQL`). `db.execute(...)` returns `Row[]` (not `{ rows }`).
- Prefer Drizzle query builder everywhere; use `db.execute<Row>(sql\`...\`)` only for Postgres-specific atomic patterns (CTEs + `FOR UPDATE SKIP LOCKED`, etc.).
- Routes:
  - `GET /api/ping`
  - `GET /api/plannings` (tree)
  - `GET /api/plannings/:fullId?events=true[&onlyDb=true]` (returns `refreshedAt` ms; db uses `plannings_backup.updated_at`)
  - `GET /api/ops/plannings` (requires `OPS_TOKEN` via `x-ops-token`; prod returns 404 on missing/invalid)
- Jobs: `RUN_JOBS=false` disables; `ALLOWED_JOBS` filters (default includes `plannings-refresh-worker`, `plannings-backfill`).
