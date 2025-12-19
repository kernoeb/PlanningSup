# Testing Guide

PlanningSup uses **Bun** for unit + integration tests and **Playwright** for E2E tests.
Most commands are defined in the root `package.json`.

## Quick Start

```bash
# Unit tests (fast, no Docker)
bun run test:unit

# Integration tests (Docker, AUTH_ENABLED=false, http://localhost:20000)
bun run test:integration

# Integration tests with auth enabled (Docker, AUTH_ENABLED=true, http://localhost:20001)
bun run test:integration:auth

# E2E (Docker + Playwright, Chrome-only by default)
bun run test:e2e

# E2E debug (headed + verbose)
bun run test:e2e:debug
```

## Passing Options to `bun run` Scripts

When you want to pass flags to a script, use `--`:

```bash
# Keep containers around for debugging
bun run test:integration -- --no-cleanup

# E2E with fewer workers, in a visible browser
bun run test:e2e -- --headed --workers 2
```

## Docker Image Build (`Dockerfile`)

`bun run docker:build` builds the production Docker image locally (tag: `test-planningsup`) using the Bun version from `.bun-version`.
During the Docker build it also runs `bun run lint`, `bun run typecheck`, `bun run build`, and `bun run test:unit` (so it’s a good “packaging smoke test”).

```bash
bun run docker:build
```

To run integration tests against that prebuilt image (using the compose Postgres container/network):

```bash
docker compose -f docker-compose.test.yml up -d postgres-test

docker run --rm --name planningsup_test_app_manual \
  --network planningsup_test_network \
  -e NODE_ENV=production \
  -e PORT=20000 \
  -e DATABASE_URL="postgresql://testuser:testpass@postgres-test:5432/planningsup_test" \
  -e RUN_JOBS=false \
  -e AUTH_ENABLED=false \
  -p 20000:20000 \
  test-planningsup

bun test test/integration/api.test.ts test/integration/auth.routes.test.ts
```

## Test Types

### Unit Tests

- **Location**: `test/*.test.ts`
- **Runner**: `bun test` (via `bun run test:unit`)
- **Notes**: The default unit script runs with `--max-concurrency=1` to reduce flakiness.

Common commands:

```bash
bun run test:unit
bun test test/jobs.test.ts
bun test test/jobs.test.ts --watch
bun test test/jobs.test.ts --test-name-pattern "quiet hours"
```

### Integration Tests (Auth Disabled)

- **Location**: `test/integration/api.test.ts`, `test/integration/auth.routes.test.ts`
- **Runner**: `bun test` (driven by `bun run test:integration`)
- **Stack**: `docker-compose.test.yml`
- **URL**: `http://localhost:20000`

Common commands:

```bash
# Full run (build image, start stack, run tests, cleanup)
bun run test:integration

# Faster loops (skip Docker build step)
bun run test:integration:local

# Keep containers running after failures
bun run test:integration -- --no-cleanup --verbose
```

### Integration Tests (Auth Enabled)

- **Location**: `test/integration/auth.routes.enabled.test.ts`
- **Runner**: `bun test` (driven by `bun run test:integration:auth`)
- **Stack**: `docker-compose.test-auth.yml`
- **URL**: `http://localhost:20001`

Common commands:

```bash
bun run test:integration:auth
bun run test:integration:auth:local
bun run test:integration:auth -- --no-cleanup --verbose
```

### E2E Tests

- **Location**: `test/e2e/*.spec.ts`
- **Runner**: Playwright
- **Stack**: `docker-compose.test.yml`
- **Default URL**: `http://localhost:20000`

Common commands:

```bash
# Default (Chrome projects only)
bun run test:e2e

# Full browser coverage (adds Safari/WebKit projects)
bun run test:e2e:safari

# Headed mode
bun run test:e2e:headed

# Custom flags (note the --)
bun run test:e2e -- --verbose --headed --workers 2
```

The E2E runner will try to install Playwright browsers if needed (it also writes `.playwright-browsers-installed` as a local marker).

## Docker Test Stacks (Local)

- `docker-compose.test.yml` (AUTH disabled)
  - App: `http://localhost:20000`
  - Postgres: `localhost:5433` → container `5432`
- `docker-compose.test-auth.yml` (AUTH enabled)
  - App: `http://localhost:20001`
  - Postgres: `localhost:5434` → container `5432`

Manual start/stop (useful for debugging):

```bash
docker compose -f docker-compose.test.yml up -d --build
docker compose -f docker-compose.test.yml ps
docker compose -f docker-compose.test.yml logs -f app-test
docker compose -f docker-compose.test.yml down -v --remove-orphans
```

## Continuous Integration (GitHub Actions)

The main CI workflow is `.github/workflows/docker-publish.yml`:

- Builds the Docker image once and uploads it as an artifact.
- The Docker build itself runs `bun run lint`, `bun run typecheck`, `bun run build`, and `bun run test:unit` (see `Dockerfile`).
- Runs integration tests in two jobs (auth disabled + auth enabled) by starting the built image with `docker run` and using a Postgres service container.
- Runs E2E tests **only when UI-related paths change** (Playwright Chromium projects only).
- Publishes the Docker image only on whitelisted branches or valid `vX.Y.Z` tags (and never from fork PRs).

## Troubleshooting

```bash
# Check stack status
docker compose -f docker-compose.test.yml ps

# App logs (local integration/e2e stack)
docker logs planningsup_test_app

# Auth-enabled app logs
docker logs planningsup_test_auth_app

# Quick health check
curl -f http://localhost:20000/api/ping
curl -f http://localhost:20001/api/ping
```

If ports are already in use:

```bash
docker compose -f docker-compose.test.yml down -v --remove-orphans
docker compose -f docker-compose.test-auth.yml down -v --remove-orphans
```

## Notes on Runners

- Don’t run Playwright specs with Bun: `bun test test/e2e/*.spec.ts` won’t work.
- Bun test doesn’t support ignore globs; target `test/*.test.ts` for unit tests and `test/integration/*.test.ts` for integration tests.
- Avoid quoted globs in shells that don’t expand them (e.g. `bun test "test/*.test.ts"`).

## First-Time Setup

```bash
git clone https://github.com/kernoeb/planningsup.git
cd planningsup
bun install
bun run test:unit
bun run test:integration
```
