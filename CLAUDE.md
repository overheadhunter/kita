# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Kita attendance planner. Parents open a personal secret link and enter, per weekday, when they plan to bring and pick up their child in the selected week. Kindergarten staff open a separate secret link and see the collected data for a week as a heatmap, so they can plan activities around busy and quiet hours. UI language is German.

## Stack

- Vue 3 (`<script setup>`, Composition API) + TypeScript (strict) + Vite + Tailwind CSS 4 (`@tailwindcss/vite`), FontAwesome for icons. No router, no state library: state lives in plain modules under `src/store/`, as in finanzen.
- Vitest with two projects in `vitest.config.ts` (kept separate from `vite.config.ts` so the Cloudflare dev plugin does not start during tests):
  - `unit`: node environment, `shared/**` and `src/**`.
  - `worker`: runs `worker/**` tests inside workerd via `@cloudflare/vitest-plugin` (formerly `vitest-pool-workers`) with a fresh local D1. Migrations are applied by `worker/test/apply-migrations.ts`. The secrets are fixed test values in `vitest.config.ts`, not `.dev.vars`.
- pnpm only (`packageManager` field in package.json). `pnpm-workspace.yaml` allows the `workerd` and `esbuild` build scripts.
- Backend: one Cloudflare Worker with static assets serves the built SPA and a small JSON API under `/api/*`. Persistence is Cloudflare D1 (SQLite). `@cloudflare/vite-plugin` makes `pnpm dev` run SPA and Worker together against a local D1 in `.wrangler/state/`, and lets `pnpm build` emit both (`dist/client`, `dist/kita`). Unlike finanzen, deployment goes to Cloudflare, not GitHub Pages, so Vite `base` is `/`.

## Commands

```sh
pnpm install
cp .dev.vars.example .dev.vars             # local secrets (once)
pnpm db:migrate                            # apply migrations/ to the local D1
pnpm db:seed                               # replace local data with scripts/seed.dev.sql
pnpm dev                                   # Vite + Worker + local D1, open http://localhost:5173/#t=familie-a (or #t=staff-dev)
pnpm test                                  # unit + worker tests
pnpm vitest run shared/week.test.ts        # single file
pnpm vitest run -t "prefills"              # tests matching a name
pnpm vitest run --project worker           # one project
pnpm typecheck                             # vue-tsc -b (app, worker, node configs)
pnpm build                                 # typecheck + build SPA and Worker
pnpm types                                 # regenerate worker/worker-configuration.d.ts after changing wrangler.jsonc or .dev.vars
pnpm token                                 # random token, e.g. for STAFF_TOKEN
pnpm wrangler d1 migrations apply kita --remote   # apply schema in production
pnpm wrangler secret put STAFF_TOKEN       # set the production staff token
```

Inside the Claude Code sandbox, wrangler cannot write to `~/Library/Preferences`, so `pnpm dev` fails with EPERM on `dev-registry`. Prefix it with `WRANGLER_REGISTRY_PATH=$TMPDIR/w/registry WRANGLER_LOG_PATH=$TMPDIR/w/logs XDG_CONFIG_HOME=$TMPDIR/w/config WRANGLER_SEND_METRICS=false`. The EPERM log-file errors and `Request.cf` warnings in other wrangler commands are harmless.

## Architecture

```
shared/     framework-free domain logic used by both SPA and Worker: week.ts (Monday keys, Berlin time, Saturday rule), plan.ts (Days type, click state machine, validation), heatmap.ts (aggregation)
src/        Vue SPA; store/api.ts holds the token and API client, components/WeekGrid.vue is the grid layout shared by PlanView (parents) and HeatmapView (staff)
worker/     Cloudflare Worker: index.ts = auth + router + D1 queries
migrations/ D1 SQL migrations (every .sql here is applied as a migration, so the dev seed lives in scripts/)
wrangler.jsonc  assets: not_found_handling = single-page-application, run_worker_first = ["/api/*"]
```

Keep domain logic in `shared/` with tests. Components only render and forward events. The Worker re-validates everything with `validateDays` and `isMonday` from `shared/`.

API (family): `GET /api/me` → `{ role, name }`. `GET|PUT /api/plans/:monday` → `{ days, source: 'saved' | 'prefill' | 'none' }`.
API (staff): `GET /api/heatmap/:monday` → `{ counts[day][slot], families, totalFamilies }`. `PUT /api/settings` `{ totalFamilies }`. `GET /api/families`, `POST /api/families` `{ name }` → `{ id, name, token }`, `DELETE /api/families/:id`.

### Auth via URL fragment

- The link carries a token in the fragment: `https://…/#t=<token>`. Fragments never reach the server, so the SPA reads the token and sends it as `Authorization: Bearer <token>` on every API call. Never put tokens in query strings or paths: they would end up in logs.
- Once the server accepts a token, the SPA stores it in localStorage (`kita.token`), so later visits without `#t` work. A `#t` in the URL always wins. A 401 clears the stored token.
- The Worker resolves the token to a role:
  - Family token: a random UUID in the `families` table, created by staff in the app ("Familien verwalten" dialog in the heatmap view). The token is both credential and identity. Families can only read and write their own rows.
  - Staff token: the `STAFF_TOKEN` secret, compared in constant time. Staff see aggregated counts for any week and manage families. Heatmap responses never contain family names.
- Unknown token → 401, and the SPA shows a "Link ungültig" screen.
- `STAFF_TOKEN` for local dev goes in `.dev.vars` (gitignored). Local demo families come from `pnpm db:seed`, with readable tokens like `familie-a`.

### Data model

Migrations are not deployed yet, so they may still be rewritten. Once production exists, only add new ones.

- `families(id, name, token UNIQUE, created_at)`: removing a family deletes only this row.
- `plans(family_id, week, days, updated_at)`, primary key `(family_id, week)`. There is deliberately no foreign key: plans of removed families stay, so past heatmaps don't change. `week` is the date of that week's Monday (`YYYY-MM-DD`), not an ISO week number (avoids week-year edge cases). `days` is a JSON array of 5 entries (Mon–Fri), each `null` (absent) or `{ "from": 7..15, "to": 8..16 }` in full hours, `to` exclusive.
- `settings(key, value)`: holds `total_families`, which staff can change at any time. Without it, the total defaults to the number of rows in `families`.

### Parent view (grid)

- 5 columns (Mo–Fr) × 9 rows of hour slots (07–08 … 15–16).
- Per day, click 1 sets the start slot (afterwards the range follows the mouse pointer or keyboard focus as a preview), click 2 sets the end slot (inclusive range, order-independent; clicking the same slot twice selects one hour). Click 3 on the same day discards that day's range and acts as a new click 1. Clicks on one day never affect other days.
- Default week is the current week in `Europe/Berlin`; from Saturday on, the following week is preselected. Families can navigate only one week back or forward from the preselected week; staff can navigate without limit. The limit is enforced in the UI only, not by the Worker.
- If a family has no row for the displayed week but has one for the week before, prefill from that. The prefill stays an unsaved draft (visibly marked) until the user edits or confirms it ("Übernehmen").
- Every completed range (second click) and every "×" (clear day) saves the whole week immediately. Saves are queued, so they reach the server in order.

### Staff view (heatmap)

Same grid. Each cell is colored by the number of children present in that hour, on a one-hue sequential blue ramp (from the `dataviz` skill's reference palette; separate light and dark ramps in `HeatmapView.vue`). The number itself appears only on hover or focus. Above the grid, "Aussagekraft" (confidence) = families with data for the week ÷ total families, capped at 100 %. The total is editable inline and applies to all weeks. Week navigation works as in the parent view. The Worker computes the counts so names never leave the server.

## Deployment

GitHub Actions on push to `main`: `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`, apply remote D1 migrations, then `wrangler deploy` (via `cloudflare/wrangler-action`). Needs repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. `STAFF_TOKEN` is a Worker secret managed with `wrangler secret put`, not in the repo.
