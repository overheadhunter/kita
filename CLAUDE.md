# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

A small site for a kindergarten at https://kita.schwanne.de. It hosts several tools that share one set of accounts: every family has a personal secret link, and staff have their own. UI language is German. Dates are always shown with leading zeros, as `dd.mm.` or `dd.mm.yyyy` (e.g. week title `KW 46 • 09.11. - 13.11.2026`).

- `/`: tool overview, filtered by role.
- `/anwesenheiten`: parents enter, per weekday, when their child will be there in the selected week. Staff see a heatmap of the week to plan activities around busy and quiet hours.
- `/verwaltung` (staff only): add and remove families, set their number of children, copy their links.

## Stack

- Vue 3 (`<script setup>`, Composition API) + TypeScript (strict) + Vite + Tailwind CSS 4 (`@tailwindcss/vite`), vue-router (HTML5 history), FontAwesome for icons. No state library: state lives in plain modules under `src/store/`, as in the sibling project `../finanzen`.
- Vitest with two projects in `vitest.config.ts` (kept separate from `vite.config.ts` so the Cloudflare dev plugin does not start during tests):
  - `unit`: node environment, `shared/**` and `src/**`.
  - `worker`: runs `worker/**` tests inside workerd via `@cloudflare/vitest-plugin` (formerly `vitest-pool-workers`) with a fresh local D1. Migrations are applied by `worker/test/apply-migrations.ts`. `STAFF_TOKEN` is a fixed test value in `vitest.config.ts`, not read from `.dev.vars`.
- pnpm only (`packageManager` field in package.json). `pnpm-workspace.yaml` allows the `workerd` and `esbuild` build scripts.
- Backend: one Cloudflare Worker with static assets serves the built app and a JSON API under `/api/*`. Persistence is one Cloudflare D1 (SQLite) database for all tools. `@cloudflare/vite-plugin` makes `pnpm dev` run app and Worker together against a local D1 in `.wrangler/state/`, and lets `pnpm build` emit both (`dist/client`, `dist/kita`).

## Commands

```sh
pnpm install
cp .dev.vars.example .dev.vars             # local STAFF_TOKEN (once)
pnpm db:migrate                            # apply migrations/ to the local D1
pnpm db:seed                               # replace local data with scripts/seed.dev.sql
pnpm dev                                   # Vite + Worker + local D1, open http://localhost:5173/#t=familie-a (or #t=staff-dev)
pnpm test                                  # unit + worker tests
pnpm vitest run shared/anwesenheiten/week.test.ts   # single file
pnpm vitest run -t "prefills"              # tests matching a name
pnpm vitest run --project worker           # one project
pnpm typecheck                             # vue-tsc -b (app, worker, node configs)
pnpm build                                 # typecheck + build app and Worker
pnpm types                                 # regenerate worker/worker-configuration.d.ts after changing wrangler.jsonc or .dev.vars
pnpm token                                 # random token, e.g. for STAFF_TOKEN
pnpm wrangler d1 migrations apply kita --remote   # apply schema in production
pnpm wrangler secret put STAFF_TOKEN       # set the production staff token
```

Inside the Claude Code sandbox, wrangler cannot write to `~/Library/Preferences`, so `pnpm dev` fails with EPERM on `dev-registry`. Prefix it with `WRANGLER_REGISTRY_PATH=$TMPDIR/w/registry WRANGLER_LOG_PATH=$TMPDIR/w/logs XDG_CONFIG_HOME=$TMPDIR/w/config WRANGLER_SEND_METRICS=false`. The EPERM log-file errors and `Request.cf` warnings in other wrangler commands are harmless. A dev server started inside the sandbox does not see file changes (no HMR, and it keeps serving stale modules even after a browser reload), so restart it after every code change.

## Architecture

Site-wide code sits at the top level. Each tool has its own folder (or file) on every layer, named after its path:

```
shared/families.ts           site-wide constants (family name length)
shared/anwesenheiten/        framework-free domain logic used by app and Worker: week.ts (Monday keys, Berlin time, Saturday rule), plan.ts (Days type, click state machine, validation), heatmap.ts (aggregation)
src/tools.ts                 registry of tools: path, title, per-role description, icon, allowed roles, lazy component; drives routes, start-page tiles and navigation
src/router.ts                routes from TOOLS plus `/` and a 404 page; route meta `roles` is checked in App.vue ("Kein Zugriff")
src/store/api.ts             token handling and typed API client, namespaced per tool (api.families, api.anwesenheiten)
src/store/session.ts         login check (`/api/me`), session state, global 401 handling
src/pages/                   site-wide pages (HomePage, VerwaltungPage, NotFoundPage)
src/anwesenheiten/           AnwesenheitenPage picks PlanView (family) or HeatmapView (staff); WeekGrid and WeekNav are shared by both
worker/index.ts              authenticates, then dispatches /api/me, /api/families/*, /api/<tool>/*
worker/auth.ts, http.ts      roles and token check; JSON response helpers
worker/families.ts           staff-only family management
worker/anwesenheiten.ts      API of the attendance tool
migrations/                  D1 SQL migrations (every .sql here is applied as a migration, so the dev seed lives in scripts/)
```

To add a tool:
1. Add an entry to `src/tools.ts`.
2. Put its pages in `src/<tool>/` and its shared logic in `shared/<tool>/`.
3. Add `worker/<tool>.ts` and register it in the `switch` in `worker/index.ts`.
4. Create its tables, prefixed `<tool>_`, in a new migration. Reference families with `family_id INTEGER NOT NULL REFERENCES families (id) ON DELETE CASCADE`.

Keep domain logic in `shared/` with tests. Components only render and forward events. The Worker re-validates every input (e.g. `validateDays`, `isMonday`).

API:
- Site-wide:
  - `GET /api/me` → `{ role: 'family', name, children } | { role: 'staff' }`.
  - Staff: `GET /api/families`, `POST /api/families` `{ name, children? }` → `{ id, name, token, children }`, `PATCH /api/families/:id` `{ children }`, `DELETE /api/families/:id`.
- Anwesenheiten:
  - Family: `GET /api/anwesenheiten/plans/:monday` → `{ children: [{ days, source: 'saved' | 'prefill' | 'none' }, …] }` (one entry per child, in order). `PUT /api/anwesenheiten/plans/:monday/:child` `{ days }` saves one child (1-based).
  - Staff: `GET /api/anwesenheiten/heatmap/:monday` → `{ counts[day][slot], families, totalFamilies }`. `totalFamilies` is the number of rows in `families`.

### Auth via URL fragment

- Links carry a token in the fragment: `https://kita.schwanne.de/#t=<token>`. Fragments never reach the server. The app reads the token and sends it as `Authorization: Bearer <token>` on every API call. Never put tokens in query strings or paths: they would end up in logs.
- Once the server accepts the token, the app stores it in localStorage (`kita.token`) and strips `#t` from the address bar, so the token isn't copied along when someone shares a page URL. Later visits work without `#t`, and a `#t` in the URL always wins. On a 401 the stored token is cleared and `#t` is stripped. On a network error `#t` stays, so a reload can retry.
- Any 401 from any page ends the session and shows "Link ungültig" (`setUnauthorizedHandler` in api.ts, set up by session.ts). Pages don't handle 401 themselves.
- The Worker resolves the token to a role:
  - Family token: a random UUID in the `families` table, created by staff on `/verwaltung`. The token is both credential and identity. Families only ever see their own data.
  - Staff token: the `STAFF_TOKEN` secret, compared in constant time. Aggregated tool responses (e.g. the heatmap) never contain family names.
- `STAFF_TOKEN` for local dev goes in `.dev.vars` (gitignored). Local demo families come from `pnpm db:seed`, with readable tokens like `familie-a`.
- The site has a single origin (`workers_dev` and `preview_urls` are off). A second origin would mean a second localStorage and another exposed API.

### Data model

Migrations are not deployed yet, so they may still be rewritten. Once production exists, only add new ones.

- `families(id, name, token UNIQUE, children, created_at)`: site-wide. Tool tables reference it with `ON DELETE CASCADE`: removing a family deletes all its tool data, past weeks included (so past heatmaps change too). D1 always enforces foreign keys.
  - Children have no names: tools address them as 1..`children` and label them "Kind 1", "Kind 2", … only when a family has two or more.
  - Lowering `children` (PATCH) deletes the dropped children's tool data from the current week on; each tool provides that cleanup, e.g. `removeChildrenFromCurrentWeek` in `worker/anwesenheiten.ts`, called from `worker/families.ts`. Past weeks stay.
- `anwesenheiten_plans(family_id, child, week, days, updated_at)`, primary key `(family_id, child, week)`: one row per child and week.
  - `week` is the date of that week's Monday (`YYYY-MM-DD`), not an ISO week number (avoids week-year edge cases).
  - `days` is a JSON array of 5 entries (Mon–Fri), each `null` (absent) or `{ "from": 7..15, "to": 8..16 }` in full hours, `to` exclusive.

### Anwesenheiten: parent view (grid)

- One grid per child (`ChildPlan.vue`, each with its own prefill, draft and save state) under a shared week navigation (`PlanView.vue`). With two or more children, each grid has a heading "Kind n".
- 5 columns (Mo–Fr) × 9 rows of hour slots (07–08 … 15–16).
- Per day, click 1 sets the start slot; afterwards the range follows the mouse pointer or keyboard focus as a preview. Click 2 sets the end slot (inclusive range, order-independent; clicking the same slot twice selects one hour). Click 3 on the same day discards that day's range and acts as a new click 1. Clicks on one day never affect other days.
- Default week is the current week in `Europe/Berlin`; from Saturday on, the following week is preselected. Families can navigate only one week back or forward from the preselected week; staff can navigate without limit. The limit is enforced in the UI only, not by the Worker.
- If a family has no row for the displayed week but has one for the week before, prefill from that. The prefill stays an unsaved draft (visibly marked) until the user edits or confirms it ("Übernehmen").
- Every completed range (second click) and every "×" (clear day) saves the whole week immediately. Saves are queued, so they reach the server in order.

### Anwesenheiten: staff view (heatmap)

Same grid. Each cell is colored by the number of children present in that hour, on a one-hue sequential blue ramp (from the `dataviz` skill's reference palette; separate light and dark ramps in `HeatmapView.vue`). The number itself appears only on hover or focus. Counts are per child. Above the grid, "Aussagekraft" (confidence) = families with data for the week (distinct families, not children) ÷ families configured on `/verwaltung` ("n von m Familien"), capped at 100 %. Next to it is a link to `/verwaltung`.

## Deployment

`develop` is the default branch. `.github/workflows/ci.yml` tests and builds every push to `develop` or `main` and every PR. On a push to `main`, a second job runs `pnpm build`, then `wrangler d1 migrations apply kita --remote`, then `wrangler deploy`. After a build, wrangler uses the generated `dist/kita/wrangler.json` (via `.wrangler/deploy/config.json`). Migrations run while the old Worker version is still serving, so they must be backwards compatible.

- **Domain:** the Worker is served at the custom domain `kita.schwanne.de` (`routes` in `wrangler.jsonc`). This requires the `schwanne.de` zone to be active in the same Cloudflare account; the deploy creates the DNS record and certificate.
- **Repo secrets:** `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers", plus Account → D1 → Edit, zone resource `schwanne.de`) and `CLOUDFLARE_ACCOUNT_ID`. The repo variable `PRODUCTION_URL` is optional.
- **Worker secret:** `STAFF_TOKEN`, managed with `wrangler secret put`, not in the repo.
- **`database_id`:** the real value in `wrangler.jsonc` is committed; it is an identifier, not a secret.
- **Setup guide:** the step-by-step guide (Cloudflare account, moving DNS, D1, token, GitHub) is in EINRICHTUNG.md (German).
