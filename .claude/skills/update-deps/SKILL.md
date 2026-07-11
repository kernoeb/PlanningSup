---
name: update-deps
description: >-
  Bring the whole PlanningSup project up to date end-to-end and open a PR:
  npm/bun deps across all workspaces (catalog-aware), the Bun toolchain, the
  Rust/Tauri crates, the Dockerfile base images, and the GitHub Actions pins —
  with a changelog review of every notable/major bump, full local verification
  (lint/typecheck/tests/build + real docker build + cargo check), and a branch
  → commit → PR. Use whenever the user asks to "update", "update deps", "make
  it up to date", "bump dependencies", "up to date project", or similar.
---

# Update PlanningSup to the latest (→ PR)

This is an autonomous playbook. Run it through to an opened PR without pausing to
ask, unless a bump has a genuinely ambiguous breaking change the user must rule on.

## Step 0 — self-install the persistence goal (do this FIRST, on your own)

The user should never have to type `/goal`. As your very first action, invoke the
`/goal` command yourself with an objective like:

> Update PlanningSup to the latest across every module type (bun/JS deps,
> Rust/Tauri, Docker base images, CI actions), changelog-checking each notable
> bump, verifying locally, and opening a PR — plus a UI QA handoff.

That installs the persist-until-done Stop hook so the run can't halt half-updated.
Then work the steps below to completion. (If the `/goal` command isn't available in
the environment, proceed anyway and simply do not stop until the PR is open.)

Read the repo `AGENTS.md` (symlinked as `CLAUDE.md`) first — it has ports,
workspace layout, and the release flow.

## 0. Golden rules (project-specific gotchas — do not relearn these the hard way)

- **NEVER `bun update --latest`.** It rewrites `catalog:` references in
  package.json into resolved `^x.y.z` strings and breaks the catalog system.
  Update by **manually editing versions** in `package.json` catalogs + workspace
  pins, then `bun install`. (`bun update -i -r` interactive is fine but can't be
  driven headless.)
- **Catalogs live in the root `package.json`** under `workspaces.catalog`
  (elysia, eden, zod, better-auth, passkey) and `workspaces.catalogs.{types,dev,ui}`.
  Workspaces reference them as `catalog:`, `catalog:dev`, `catalog:ui`, etc.
  Bump the catalog entry once and every consumer follows.
- **`bunx` silently fetches `@latest` for a tool that isn't a local devDep.**
  Every workspace that runs `tsc`/`vue-tsc`/`eslint` must list them (via catalog)
  in its own devDependencies, or it'll run an unpinned version.
- **Root script fan-out (`scripts/run.ts`) EXCLUDES `apps/app` and
  `apps/extension`.** After the root `lint/typecheck/test`, verify those two
  workspaces manually (`cd apps/extension && bun run lint && bun run typecheck`,
  `cd apps/app && bun run lint && bunx --bun vue-tsc --noEmit`).
- **`.bun-version`** is the single source of truth for the Bun version — it feeds
  the Docker build image (`--build-arg BUN_VERSION`) and CI (`oven-sh/setup-bun`
  reads the file). Bump it to match `bun --version`.
- `*` in `bun outdated` means an even-newer release is withheld by min-release-age.
  Take the **recommended** (non-`*`-blocked) version, not the bleeding edge.

## 1. Survey

```bash
sc worktree status --json           # confirm target branch
bun --version; cat .bun-version
bun outdated -r                     # the full cross-workspace list
```
Also read every `package.json` (`apps/*`, `packages/*`, `test/`), the `Dockerfile`,
`docker-compose.yml`, `apps/app/src-tauri/Cargo.toml`, and `.github/workflows/*.yml`.

## 2. Triage + changelog review

Split `bun outdated` into **safe** (patch/minor within a major) and **notable**
(any major bump, or an auth/build-critical package). For every notable bump,
review the changelog (GitHub releases / CHANGELOG / npm) for breaking changes —
**fan out parallel research subagents** (grouped, ~3 packages each) so it's fast.
Report per package: breaking? what breaks? raised Node/engine min?

Known findings from past runs (re-verify, but expect these):
- **better-auth + @better-auth/passkey** (1.5→1.6+): no DB migration for this
  project (twoFactor plugin unused; passkey/user/session/account/verification
  tables unchanged). Behavioral passkey hardening only. Confirm with
  `drizzle-kit generate` → "No schema changes".
- **@antfu/eslint-config** major (8→9+): `perfectionist()` no longer defaults its
  options arg → must call `perfectionist({})` in `apps/api/eslint.config.js`.
- **concurrently / lint-staged** majors: ESM-only, raised Node (≥22) + Git (≥2.32)
  mins — satisfied by `engines.node>=24`. Inline JSON config unaffected.
- **temporal-polyfill** 0.x→1.x: only the ISO `/global` entrypoint is used
  (`apps/{app,web}/src/main.ts`), so the non-ISO calendar entrypoint split is N/A.

## 3. Apply the version bumps

Edit the root `package.json` catalogs + each workspace's pinned versions, then:
```bash
bun install
```
Keep sibling packages in lockstep (e.g. all `@schedule-x/*` on the same version;
note `@schedule-x/vue` versions independently — don't force it to the others'
number). Bump `.bun-version` to the installed Bun.

### Known code/config fixes triggered by bumps
- **`@simplewebauthn/server` dedup (TS2883).** `@better-auth/passkey` pulls
  `@simplewebauthn/server` transitively; if you bump the direct `apps/api` devDep
  to a version the plugin doesn't also resolve to, TS sees two copies and errors
  "inferred type ... cannot be named / not portable". Fix: add a root
  `package.json` `"overrides": { "@simplewebauthn/server": "<version>" }` so the
  whole tree dedupes to one copy, then `rm -rf node_modules **/node_modules &&
  bun install` (a plain reinstall can leave a stale symlink).
- **better-auth 1.6 Discord profile.** `mapProfileToUser(profile)` — `profile.email`
  is now `string | null | undefined`; guard the `eq(user.email, profile.email)`
  update behind `if (profile.email) { ... }` in `apps/api/src/utils/auth.ts`.

### Regenerate auth/db schemas (needs the DB up)
```bash
docker compose up -d              # generate-better-auth HANGS without Postgres
cd apps/api
bun run generate-drizzle          # expect "No schema changes, nothing to migrate"
bun run generate-better-auth      # regenerates src/db/schemas/auth.ts; expect empty diff
```
If a real schema diff appears, that IS a migration — review it and commit the new
`drizzle/*.sql`. `git status apps/api/src/db/schemas/auth.ts` should be clean when
no auth fields changed.

## 4. Verify (all must pass)

```bash
bun run lint-fix && bun run lint && bun run typecheck && bun run test:unit
```
Then the two excluded workspaces, and the builds:
```bash
cd apps/extension && bun run lint && bun run typecheck && bun run build; cd -
cd apps/app && bun run lint && bunx --bun vue-tsc --noEmit; cd -
NODE_ENV=production bun run build          # api + web
bun install --frozen-lockfile              # what Docker's install step runs
bun run validate:workflows
```
A harmless `inlineDynamicImports … deprecated` warning comes from inside
`vite-plugin-pwa`, not our config — ignore it.

### Docker smoke (validates .bun-version base image + the whole CI build path)
```bash
docker info >/dev/null 2>&1 || orbctl start   # OrbStack on this Mac
bun run docker:build                          # runs frozen-install→lint→typecheck→build→test:unit in-container
```

## 5. Rust / Tauri (apps/app/src-tauri) — outside the JS fan-out

```bash
cd apps/app/src-tauri
cargo update                # refresh Cargo.lock within existing ranges
cargo update --dry-run --verbose | grep -iE 'tauri|serde|behind latest'  # spot direct-dep floors to bump
# bump the pinned floors in Cargo.toml (tauri, tauri-plugin-opener, tauri-plugin-single-instance) to match
cargo check                 # full app must compile (~1 min cold)
```

## 6. Dockerfile base images + CI action pins

Base images: `oven/bun` (via `.bun-version` ✓), `chainguard/glibc-dynamic:latest`
(floats ✓), `ghcr.io/tarampampam/microcheck:1` (floats to latest 1.x; no v2),
`postgres:18` (latest major). Usually nothing to change beyond `.bun-version`.

GitHub Actions — find newer majors, then bump only those:
```bash
for repo in docker/metadata-action actions/checkout docker/setup-buildx-action \
  actions/upload-artifact docker/build-push-action oven-sh/setup-bun actions/cache \
  softprops/action-gh-release actions/download-artifact actions/setup-node \
  docker/login-action actions/attest-build-provenance dorny/paths-filter; do
  latest=$(git ls-remote --tags --refs "https://github.com/$repo" | awk -F/ '{print $NF}' \
    | grep -E '^v[0-9]+$' | sort -V | tail -1)
  printf "%-38s %s\n" "$repo" "$latest"
done
```
Before bumping a major, check its release notes for breaking changes and confirm
they don't apply here:
- **checkout v7** blocks fork-PR checkout on `pull_request_target`/`workflow_run`
  — our workflows only use `push`/`pull_request`, so it's safe.
- **setup-node v5+** auto-caches when a `packageManager` field exists — we have
  none, and jobs run on `ubuntu-latest` (Node 24 runtime present), so safe.
- **cache v6 / action-gh-release v3** just require the Node 24 runtime — provided
  by `ubuntu-latest`.

Apply with `sed -i 's#actions/checkout@v6#actions/checkout@v7#g' ...` (GNU sed on
this Mac — `sed -i`, never `sed -i ''`). Then `bun run validate:workflows`.

## 7. Branch, commit, PR

Branch first (never commit dep bumps straight to `main`):
```bash
git checkout -b chore/dependency-updates
```
Commit in logical chunks (JS/bun/Docker; then Rust + CI actions) with plain,
descriptive messages — no attribution/co-author trailers, no tool footers.
The `simple-git-hooks` pre-commit runs `lint-staged` (lint-fix + lint + typecheck
on staged files) — let it run; it's a live check that the bumped toolchain works.

Push and open the PR with `gh pr create --base main`. Write a body that tables the
notable bumps with the "verdict" of the changelog review, lists the code/config
fixes the bumps forced, states the verification done (tests count, docker build,
cargo check), and calls out what was deliberately left as-is (already-latest
images/actions) — no tool footer. Then report the PR URL. Do not merge — CI's
`docker-publish` pipeline runs on the PR.

## 8. UI QA handoff (always end here)

Package bumps pass tests but can shift visuals silently. After the PR is open,
produce a concise **QA checklist** for the user covering every UI-affecting bump —
`daisyui`, `@schedule-x/*`, `@lucide/vue`, `tailwindcss`, `vue`. For each, read the
changelog for *visual/behavioral* changes, then grep the app for what's actually
used and only list what applies. Reference from the last run:

- **daisyui** minor bumps often restyle components — the 5.6 line rewrote **button
  states** (checked/disabled/soft/ghost/link/focus) and changed modals to
  popover-based + tooltip alignment. The app uses `btn`/`btn-ghost`/`btn-circle`/
  `btn-primary` heavily, plus `modal`, `tooltip`, `toggle`, `range` → QA those.
- **@schedule-x/*** — the app uses Day/Week/MonthGrid/MonthAgenda views +
  calendar-controls + current-time + timezone. Watch view-switching, the
  view-selector/timezone triggers (became `<button>` for a11y), month-agenda event
  indicator dots, view-change animations, and recurring-event expansion.
- **@lucide/vue** — check whether any *redesigned* glyphs are used (last run: none
  of martini/carrot/ungroup/text-cursor/landmark were), else it's just new icons.

Hand the checklist to the user as the final message (grouped by module, with the
specific screens/components to click through). This is the deliverable, not an
afterthought.
