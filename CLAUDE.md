# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A multi-provider (bKash/Nagad/Rocket) mobile-money "super agent" liquidity & anomaly
decision-support prototype, built for a hackathon. `Statement.md` is the original challenge
brief; `Instructions.md` is the product owner's design notes on top of it; the active
implementation plan/checkpoint log lives in conversation history and `PROMPTS.md` (one prompt
entry per commit, per submission requirements).

Two independent npm projects — `server/` (Express + TypeScript API) and `client/` (React +
Vite + Tailwind + shadcn/ui) — not a workspace/monorepo. Run commands from inside each
directory.

The build is happening in checkpoints (schema/seed → auth/subdomains → simulation engine → AI
analysis pipeline → dashboards). Ask before starting a new checkpoint if it's not obvious one
was just approved.

## Commands

### Server (`server/`)

```
npm run dev          # tsx watch src/server.ts, http://localhost:4000
npm run build         # tsc -> dist/
npm run start          # run compiled dist/server.js
npm run db:generate    # drizzle-kit generate — creates a migration from schema.ts
npm run db:migrate     # drizzle-kit migrate — applies migrations to DATABASE_URL
npm run db:seed        # wipes and reseeds synthetic blocks/agents/parties/transactions
npm run db:studio      # drizzle-kit studio — browse the DB
```

No test runner or lint script is configured yet.

### Client (`client/`)

```
npm run dev      # vite dev server, http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

### Infra

```
docker compose up -d                                  # Postgres only (root docker-compose.yml)
docker compose -f docker-compose.sonarqube.yml up -d  # SonarQube, http://localhost:9000
```

## Architecture

### Server

Module-per-feature under `src/modules/<name>/`, each with `*.routes.ts` → `*.controller.ts`
→ `*.service.ts`. Routes are mounted in `src/routes/index.ts` under `/api`, which is mounted
in `src/app.ts`. `src/server.ts` just calls `app.listen`.

- **Env**: `src/config/env.ts` parses `process.env` through a Zod schema at import time and
  throws if required vars are missing. Every module imports `env` from here rather than
  touching `process.env` directly. `CLIENT_URLS` is a comma-separated list (agent + ops
  subdomain origins), not a single URL.
- **DB**: `src/db/index.ts` exports a single `db` (drizzle + postgres-js) built from
  `DATABASE_URL`. Schema lives in `src/db/schema.ts`; run `db:generate` after editing it and
  commit the resulting SQL file in `drizzle/`. Domain tables: `blocks` (operational areas),
  `agents` (the shop entities — distinct from `users`, the login accounts), `agentProviderBalances`
  (one row per agent per provider), `parties` (synthetic counterparty pool), `transactions`,
  `daysOfInterest` (global or block-scoped demand multipliers), `alerts` (liquidity or anomaly,
  with evidence/confidence/status/owner), `caseEvents` (the alert audit trail/coordination log).
  `src/db/seed.ts` (`npm run db:seed`) truncates and reseeds all of the above: ~8 Dhaka blocks,
  100 agents, 1 ops login per block, 1 agent login per agent, a shared party pool, and several
  days of historical transactions per agent. It prints the demo login credentials on completion.
- **Auth** (`modules/auth/`): login-only (email+password against seeded accounts) — there is no
  self-registration; agent and ops accounts are provisioned by the seed script only. No Google
  sign-in. `requireAuth` reads `Authorization: Bearer <jwt>` and sets `req.userId`/`req.userRole`/
  `req.agentId`/`req.blockId` from the JWT payload (`utils/jwt.ts`); `requireRole("agent" | "ops")`
  gates routes to one portal. Provider separation and role boundaries are a hard product
  requirement (see `Statement.md` §6/§14) — don't add anything that lets one provider's data or
  authority bleed into another's.
- **AI** (`modules/ai/`): `ai.service.ts` calls providers in `providers/` in order
  (OpenAI → Groq → Gemini → OpenRouter) via `generateText()`, each wrapped in a timeout
  (`PROVIDER_TIMEOUT_MS`). It moves to the next provider on any error or timeout and returns
  which provider actually served the response. Providers are skipped if their API key isn't
  set (`isConfigured()`). To add a provider: implement the `AiProvider` interface in
  `types.ts` and push it into `PROVIDER_CHAIN`. OpenAI (`openai.provider.ts`, model
  `gpt-4o-mini` — cheap/fast, enough for a short structured-JSON judgment) is first because it
  was the freshest key with headroom left after Groq/Gemini/OpenRouter all started hitting
  rate limits/timeouts in the same session; the others stay behind it as fallback. The anomaly
  LLM voter was briefly a 3-model parallel-query consensus sub-ensemble (Groq+Gemini+OpenRouter,
  majority vote) instead of this single fallback-chain call — reverted back to one call per
  check once a fresh OpenAI key made the multi-model redundancy unnecessary; the single voter
  is simpler and cheaper, and still only 1 of the 5 anomaly checks either way (see below).
- **Simulation** (`modules/simulation/`): an in-process virtual clock (`setInterval`, real
  ticks every 2s) with a speed multiplier for fast-forward. Each tick generates plausible
  transactions per agent (base rate × time-of-day × any active `daysOfInterest` multiplier),
  mutating an in-memory balance cache and periodically persisting to `agents`/
  `agentProviderBalances`/`transactions`. Routes start/stop/set speed and list/trigger named
  scenarios (`simulation.types.ts` → `SCENARIOS`) that bias generation for a target
  block+provider for a duration (every agent in that block gets the scenario applied — one
  `activeScenarios` entry per affected agent internally, keyed by agent id as before), tagging
  rows with `scenarioTag`. Deliberately **public, no auth** — this is a judge-facing demo
  control tool, not part of the agent/ops role system, and it only ever touches synthetic data.
  `GET /api/simulation/blocks` is a lightweight id/name list for the control panel's block
  picker, separate from the role-gated `GET /api/agents`. `CLIENT_URLS` includes plain
  `http://localhost:5173` (not just the two subdomains) so this page works regardless of
  hostname.
  `ensureLoaded()` self-heals if `npm run db:seed` truncates/regenerates the database while
  this process is still running: it checks whether a previously-cached agent id still resolves
  in the DB before every tick/start/trigger, and transparently reloads (clearing
  `activeScenarios`/cooldowns too) if not — no server restart needed after a reseed anymore.
  `tick()` also catches its own errors so a transient DB failure can't crash the process via an
  unhandled rejection (it was `void tick()` off a `setInterval`, so an uncaught throw there
  previously would have been fatal).
- **Analysis** (`modules/analysis/`): the two required AI jobs, both reusing `modules/ai` as
  one voter among several — never the sole source of truth, and never allowed to output
  "fraud" language, only "unusual"/"requires review" plus evidence and a confidence figure.
  - `liquidity.service.ts`: projects time-to-shortage per agent for cash and each provider
    independently from a recent burn rate; confidence drops when the transaction sample is
    small or has timing gaps (the Scenario C "stale/sparse data" requirement).
  - `anomaly.service.ts`: 5-voter ensemble per agent+provider (velocity z-score,
    near-identical-amount clustering, structuring/splitting, balance reconciliation, plus one
    LLM voter) — needs ≥2 of 5 to agree before writing an alert; majority category, max
    severity, agreement-weighted confidence.
  - `analysis.service.ts` (`analyzeAgent`) runs both and is called from the simulation tick
    loop for touched agents, throttled by a 20s real-time-per-agent cooldown
    (`ANALYSIS_COOLDOWN_MS` in `simulation.service.ts`) so LLM calls stay bounded regardless of
    simulation speed.
  - `analysis.shared.ts` has the `upsertAlert` dedup logic (updates the existing open alert for
    the same agent/type/provider/category instead of spamming new rows) and writes the first
    `caseEvents` "created" row, owner = the agent's block's ops user.
  - Routes: `GET /api/analysis/alerts` is role-scoped (agent → own alerts only, ops → own block
    only) and `POST /api/analysis/recompute` is ops-only, for on-demand analysis outside the
    tick loop. `PATCH /api/analysis/alerts/:id` (ops-only, body `{action, note?}` with action
    one of `acknowledge`/`escalate`/`resolve`) is the coordination action endpoint — it 403s if
    the alert's `blockId` doesn't match the caller's, and always writes a `caseEvents` row via
    `applyAlertAction` in `analysis.shared.ts`.
  - Known limitation from live testing: the liquidity burn-rate heuristic is fairly sensitive
    and will flag several agents at once during a fast-forwarded run even without a triggered
    scenario, just from normal random-walk variance. Worth tuning thresholds once there's a
    real false-positive-rate metric to validate against (a required deliverable) rather than
    guessing now.
  - `trend.service.ts` (`analyzeTrend(blockId)`): a third, block-level alert type (`"trend"`,
    alongside `"liquidity"`/`"anomaly"`) — a day-of-week demand forecast, e.g. "Elevated demand
    expected — Uttara (Thursday)". Pools every agent's transactions in the block (a single
    agent's history is too sparse to trust a recurring pattern; ~10-15 agents sharing the same
    weekday gives a real sample) and checks whether any of the next 7 days is a weekday that's
    historically run significantly busier than average (needs >=2 observed occurrences of that
    weekday and >30% above the block's overall daily average). This can only detect
    day-of-week seasonality, not day-of-month/monthly seasonality — that would need months of
    elapsed calendar time regardless of how many agents are pooled, which the seed data doesn't
    have. Always `severity: "low"` (a planning heads-up, not an urgent finding). Because it's
    not about any single agent, `alerts.agentId` is nullable for this type — `upsertAlert`'s
    dedup query handles a null agentId via `isNull()` instead of `eq()`, and
    `listAlertsHandler`'s agent-role branch additionally fetches block-level (agentId-null)
    alerts for the caller's own block via `resolveEffectiveBlockId` (from
    `modules/daysOfInterest/`), since an agent JWT only carries `agentId`, not `blockId`.
    Triggered from the simulation tick loop like the per-agent checks, but on its own, much
    longer cooldown (`TREND_COOLDOWN_MS`, 5 real minutes vs. `ANALYSIS_COOLDOWN_MS`'s 20
    seconds) since weekly patterns don't need re-checking anywhere near as often.
  - Seed data has a small, documented weekday volume bias (`WEEKDAY_VOLUME_MULTIPLIER` in
    `seed.ts`: Thursday busier, Friday/Saturday quieter, mirroring Bangladesh's Friday-Saturday
    weekend) specifically so `analyzeTrend` has a genuine recurring pattern to find — uniform
    random timestamps (the prior behavior) have no day-of-week signal by construction.
    `HISTORY_DAYS` is 14 (was 5) so every weekday gets at least 2 occurrences to work with.
  - Found and fixed a real bug while building this: all `timestamp` columns in `schema.ts` were
    `timestamp` (no timezone). Writes serialized a JS Date's UTC clock digits into the naive
    column, but reads reinterpreted those same naive digits using the Node process's local
    timezone, silently shifting every read-back timestamp by the local UTC offset. This was
    invisible everywhere else in the app because the existing liquidity/anomaly window logic
    only ever compares two read-back timestamps to each other (the shift cancels out), but
    `analyzeTrend` extracts an absolute calendar weekday from a single timestamp, which broke
    immediately. Fixed by switching every `timestamp(...)` column to
    `timestamp(..., { withTimezone: true })` — always round-trips as an unambiguous instant
    regardless of session/client timezone.
- **Agents** (`modules/agents/`): `GET /api/agents/me` (agent role) returns the caller's own
  agent record + provider balances; `GET /api/agents` (ops role) returns `{ block, agents }` —
  every agent in the caller's block with balances, plus the block row itself (for map
  centering). Both merge `agentProviderBalances` rows into a `balances` object keyed by
  provider in the service layer (`agents.service.ts`) rather than the client.
- **Days of interest** (`modules/daysOfInterest/`): `GET /api/days-of-interest` returns global
  + the caller's own block's entries for either role — for an agent, the "own block" is
  resolved by looking up their `agents.blockId` (agent JWTs don't carry `blockId` directly,
  only `agentId`); `POST /api/days-of-interest` (ops-only) always forces `scope: "block"` and
  the caller's own `blockId` — an ops user can never create a global entry.
- **Banglish alerts**: `alerts.banglishSummary` (nullable text) is a deterministic
  Banglish-language rendering of the same situation/evidence/next-step as the English
  `description` — built with a plain template in `liquidity.service.ts`/`anomaly.service.ts`
  (not an LLM call, so it's as reliable as the numbers it's templating) and passed through
  `upsertAlert`.
- **Errors**: throw `AppError(message, statusCode)` from anywhere in a request path; the
  global `errorHandler` in `app.ts` catches it (and `ZodError` from `.parse()` calls) and
  formats the response. Express 5 forwards rejected async handlers to this automatically — no
  manual try/catch or wrapper needed in controllers.
- **Rate limiting**: `globalRateLimiter` applies to all of `/api`; `authRateLimiter` and
  `aiRateLimiter` in `middleware/rateLimiter.ts` are stricter and applied per-route.

Module boundary convention: routes only call controllers, controllers only call services,
services own all DB/provider access. Keep new features in their own `modules/<name>/`
directory following this shape.

### Client

- **Path alias**: `@/*` → `src/*` (configured in both `tsconfig.app.json` and
  `vite.config.ts` — keep them in sync if you change it).
- **Single-page login, role-driven dashboard**: this used to be subdomain-routed (`agent.*`/
  `ops.*`); it's now one entry point. `App.tsx` reads auth state from `useAuthStore` — logged
  out → `src/components/LoginPage.tsx` (a single email/password form with a cosmetic Agent/Ops
  toggle that only changes the copy shown, not what credentials are accepted); logged in →
  `src/apps/AgentApp.tsx`'s `AgentDashboard` or `src/apps/OpsApp.tsx`'s `OpsDashboard`, chosen by
  the real `user.role` from the JWT, never by the toggle or hostname. There is no
  mismatched-role state to guard against anymore (no `RoleMismatch`/`DevPicker` — both were
  deleted), since the dashboard shown is always derived from the account that actually logged
  in. `App.tsx` still checks `window.location.pathname` first: `/simulator` always renders
  `src/pages/SimulatorPage.tsx`, the one path-addressed exception. `vite.config.ts`'s
  `server.allowedHosts` for `agent.localhost`/`ops.localhost` and the README's hosts-file
  instructions are now vestigial — visiting either subdomain still loads the same app, just
  without any special handling.
  Both `AgentDashboard` and `OpsDashboard` poll `/agents/me`+`/analysis/alerts`
  (agent) or `/agents`+`/analysis/alerts` (ops) every 15s via `src/lib/agentsApi.ts`/
  `alertsApi.ts`. `src/components/AlertList.tsx` is shared between both — pass `onAction` to
  get the acknowledge/escalate/resolve buttons (ops only; the agent view renders it read-only);
  it also renders `alert.banglishSummary` under the English description when present, and (ops
  view only, via `onAction`'s presence) a Scenario/Background origin badge derived from
  `alert.scenarioTag`.
  `OpsDashboard` additionally has: `src/components/AgentMap.tsx` (`react-leaflet` + CartoDB dark
  tiles, no API key; markers use `L.divIcon` — plain colored circles, not the default Leaflet
  marker images, which have a well-known broken-asset-path problem under Vite); a
  `selectedAgentId` state that switches the balance cards and alert list between "whole block
  aggregate" (nothing selected — summed client-side from the agent list) and "just this agent"
  (clicking a map marker or a table row selects it); a plain-text search box filtering the
  agent table/map by name or phone; and client-side alert filters (type/severity/provider/
  status/scenario-origin) — all client-side since a block's roster and alert volume are small,
  no server round trip needed. Layout is a two-column grid on large screens: map + agent table
  in the primary (wider) column, alerts + `src/components/DaysOfInterestPanel.tsx` in a sidebar
  column — previously all of this was stacked in one column. `src/lib/uiClasses.ts` exports
  `nativeSelectClass`, the shared style for every plain `<select>` in the app (filters here and
  in `SimulatorPage.tsx`), so they stay visually consistent without a shadcn `Select` component.
- **Simulation control page** (`src/pages/SimulatorPage.tsx`, at `/simulator`): no login, no
  role check — talks directly to the public simulation routes (`src/lib/simulationApi.ts`).
  Start/stop/speed controls, a live status poll (3s), and a scenario-trigger form (agent
  picker grouped by block via `GET /api/simulation/agents`, scenario, provider, duration).
  This is a demo/judge convenience tool, not part of the agent/ops product surface.
- **UI**: shadcn/ui (Nova preset, Radix-based) in `src/components/ui/`. Add more components
  with `npx shadcn@latest add <name>`. Don't hand-edit generated primitives beyond what
  `add` produces — re-run `add` instead.
- **Theme**: dark-mode only, forced via `class="dark"` on `<html>` in `index.html`. Colors are
  defined as CSS variables in `src/index.css` (`:root` and `.dark` are kept identical): background
  `#201D1D`, foreground `#F4F4F4`, primary/accent `#A1FF62`. Change colors there, not with
  inline hex values in components — use the Tailwind tokens (`bg-background`, `text-foreground`,
  `bg-primary`, etc.) so the palette stays centralized.
- **State**: Zustand store per concern (see `src/store/useAuthStore.ts`), persisted to
  localStorage via the `persist` middleware where it should survive reloads (e.g. auth token).
  `AuthUser` carries `role`/`agentId`/`blockId` alongside the base profile fields.
- **HTTP**: single axios instance in `src/lib/axios.ts` with `baseURL` from
  `VITE_API_URL`. It auto-attaches the Zustand auth token as a Bearer header and clears auth
  state on a 401 response. Import `api` from there rather than creating new axios instances.
  A JWT's `blockId`/`agentId` is fixed at login time — if `npm run db:seed` regenerates the
  database while an old token is still in localStorage, that token is still *signature*-valid
  but points at a block/agent that no longer exists, and dashboard fetches 404 instead of 401
  (so the axios interceptor's auto-logout doesn't catch it). `AgentApp.tsx`/`OpsApp.tsx`'s
  `refresh()` catches this itself — any fetch failure there force-logs-out with a toast rather
  than leaving the page stuck on "Loading..." forever (an actual bug that shipped briefly: the
  fetch was unawaited-for-errors, so a rejected promise just left `loading` stuck `true`).
- **Auth UI**: no signup, no Google sign-in, no modal — `src/components/LoginPage.tsx` is the
  one full-page email/password form, rendered by `App.tsx` whenever there's no authenticated
  user. `src/lib/authApi.ts` exposes just `login`; on success it calls `useAuthStore.setAuth`.
  `src/components/AppHeader.tsx` is the shared top bar (brand mark + page title + role badge +
  avatar dropdown with sign-out) for authenticated views.

## Environment variables

Each package has its own `.env.example` (`server/.env.example`, `client/.env.example`) plus a
root `.env.example` for `docker-compose.yml`'s Postgres credentials. See `README.md` for which
values need a free account signup (Groq, Gemini, OpenRouter) versus which are self-generated
(`JWT_SECRET`).

## Prompt log

`PROMPTS.md` at the repo root logs the prompt behind each commit (a challenge submission
requirement). Append to it — don't replace — when committing.
