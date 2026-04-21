# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/meal-planner` (`@workspace/meal-planner`)

Expo / React Native mobile app — **Sortii**, a weekly household meal planner for Australian households. Frontend-only, all data stored via AsyncStorage, no backend.

**Key design:**
- Brand: "Sortii" — teal-green `#2A8F88`, gold CTA `#D29A22`, deep plum `#5E3A4C`, cream bg `#F7F3EB`
- Logo: `assets/images/sortii-logo.png` — full lockup with "sortii." and "Dinner... Sorted." tagline
- **330 recipes** in `data/recipes.json` — IDs r001–r392 (55 new AU/UK sourced recipes added r300–r392); image URLs updated to Bing CDN thumbnails; all recipes have `categoryTags` field (values: everyday, premium, kid-friendly, fussy-eater, gluten-free, vegan, vegetarian, batch-cooking, quick, budget, low-prep)
- `constants/recipes.ts` — Recipe/PlanPreferences interfaces, utility functions, filter/score helpers, kidFriendly support
- `context/PlannerContext.tsx` — all plan state, staged-scoring `autoGeneratePlan`, `planHasLimitedVariety` flag, kid-friendly scoring
- `components/Toast.tsx` — animated toast (variants: success, info, undo, warning, smart-tip)
- `components/MealSlotCard.tsx` — planner slot card with tappable body (opens recipe), colour-coded action icons
- `components/RecipeDetailModal.tsx` — full hero image banner + recipe details
- `app/index.tsx` — 7-step onboarding flow (welcome → planning mode → household → budget → meals/wk → dietary → exclusions → generating)
- `app/(tabs)/planner.tsx` — main planner: progress bar, home icon, per-meal confirmations, undo, prefs-dirty bar, bottom action bar
- `app/(tabs)/preferences.tsx` — 4-tier collapsible accordion settings (Quick Setup / Make it Yours / Make it Smarter / Advanced)
- `app/(tabs)/shopping.tsx` — grouped shopping list with copy/share
- `app/home.tsx` — info/about screen with Sortii logo and how-it-works

**Connected Intelligence Layer (5 phases — all complete):**
- Phase 1: Bills Regular/One-off toggle (UI + `billType` field, colour coding)
- Phase 2: Appointment cost flag + availability block (`appointmentCost`, `availabilityBlock`) surfaced in Family tab
- Phase 3: Money tab 3 states — Calm/Tight/Stretched — driven by `adjustedBreathingRoom = weeklyBreathingRoom - pressureTotal`; `pressureTotal` aggregates one-off bills + appointment costs this week
- Phase 4: Overwhelm Mode — `components/OverwhelmModal.tsx`; full-screen FOCUS MODE overlay with max 3 prioritised items (urgent bills → urgent appointments → tonight's dinner); triggered from money.tsx State 3 AND "Help me sort this" button on Home
- Phase 5: Home screen synthesis — `home.tsx` Money card reflects 3 states; "What's Coming Up" card synthesises one-off bills (0–14d) + cost appointments + availability blocks + family juggle conflicts + meals coverage; availability conflict auto-detection (appointment `availabilityBlock.personIds` cross-referenced against family events same day/person); "Help me sort this" now triggers OverwhelmModal with live data

**Cross-module layer (v3 additions):**
- `utils/weeklyAggregate.ts` — pure aggregation layer: `buildTimelineItems`, `groupByBucket`, `generateWeeklySummary`, `deriveReminders`, `filterItems`, shared types `TimelineItem`, `ReminderItem`, `SourceType`, `DateBucket`
- `app/(tabs)/upcoming.tsx` — "What's Coming Up" unified timeline screen; also exports `WeeklyGlanceCard` and `ReminderStrip` components for home.tsx
- `app/(tabs)/home.tsx` — imports WeeklyGlanceCard (hides when no data) + ReminderStrip (shows top 3 reminders with severity colours)
- `app/(tabs)/appointments.tsx` — full CRUD: 8 categories, date/time pickers, prep checklists, reminder/recurring toggles
- `app/(tabs)/bills.tsx` — full CRUD: 10 categories, recurring bills, auto-advance on mark-paid, status computed from due date
- `app/(tabs)/more.tsx` — "Organised life" section links to What's Coming Up, Appointments, Bills

**Data model:**
- AsyncStorage keys: `@sortii_appointments_v1`, `@sortii_bills_v1`, `@sortii_family_v2`, `@sortii_juggle_result_v1`
- `FamilyState.members` — `{ id, name, role, color }` with `FamilyEvent` having `personIds[]` and optional `driverId`
- Reminder severities: `important` (red) → `heads_up` (gold) → `gentle` (teal)

**Colour palette tokens** (in `constants/Colors.ts`):
- `primary` = teal `#2A8F88`, `primaryDark` = `#257D78`, `gold` = `#D29A22`, `goldDark` = `#B97D12`
- `plum` = `#5E3A4C`, `plumTint` = `#F3E8EE`, `tealTint` = `#E6F3F0`, `goldTint` = `#F6E6BA`
- `secondaryActionBg` = `#EAF4F2`, `secondaryActionText` = `#257D78`, `clearBg` = `#F7E9E8`, `clearText` = `#B86557`
- `seasonalGreen` = `#5F7C50`, `seasonalGreenBg` = `#EAF3E2`

**Icon/badge colour system:**
- Teal (`#2A8F88`) = standard action (open recipe, fill gaps, save, meal type badge)
- Gold (`#D29A22`) = primary/featured action (CTA, auto-swap smart action)
- Plum (`#5E3A4C`) = smart/alternative action (swap, hide, smart-tip toasts)
- Warm red (`#B86557`) = destructive (remove, clear, warning toasts)

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
