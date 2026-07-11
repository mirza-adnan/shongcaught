# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

A multi-provider (bKash/Nagad/Rocket) mobile-money "super agent" liquidity & anomaly
decision-support prototype, built for a hackathon. `Statement.md` is the original challenge
brief; `Instructions.md` is the product owner's design notes on top of it.

Two independent npm projects — `server/` (Express + TypeScript API) and `client/` (React +
Vite + Tailwind + shadcn/ui) — not a workspace/monorepo. Run commands from inside each
directory.

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
  `src/db/seed.ts` (`npm run db:seed`) truncates and reseeds all of the above and prints demo
  login credentials on completion.
- **Auth** (`modules/auth/`): login-only (email+password against seeded accounts) — no
  self-registration, no Google sign-in; agent/ops accounts are provisioned by the seed script
  only. `requireAuth` sets `req.userId`/`req.userRole`/`req.agentId`/`req.blockId` from the JWT
  payload (`utils/jwt.ts`); `requireRole("agent" | "ops")` gates routes to one portal. Provider
  separation and role boundaries are a hard product requirement — don't let one provider's data
  or authority bleed into another's.
- **AI** (`modules/ai/`): `ai.service.ts` calls providers in `providers/` in order
  (Groq → Gemini → OpenRouter) via `generateText()`, each wrapped in a timeout
  (`PROVIDER_TIMEOUT_MS`). It moves to the next provider on any error or timeout and returns
  which provider actually served the response. Providers are skipped if their API key isn't
  set (`isConfigured()`). To add a provider: implement the `AiProvider` interface in
  `types.ts` and push it into `PROVIDER_CHAIN`.
- **Simulation** (`modules/simulation/`): an in-process virtual clock (`setInterval`, real
  ticks every 2s) with a speed multiplier for fast-forward. Each tick generates plausible
  transactions per agent (base rate × time-of-day × any active `daysOfInterest` multiplier),
  mutating an in-memory balance cache and periodically persisting to `agents`/
  `agentProviderBalances`/`transactions`. Routes start/stop/set speed and list/trigger named
  scenarios (`simulation.types.ts` → `SCENARIOS`) that bias generation for a target
  block+provider for a duration (applies to every agent in that block at once). Deliberately
  **public, no auth** — a judge-facing demo tool, not part of the role system, touches only
  synthetic data. `GET /api/simulation/blocks` is a lightweight picker list, separate from the
  role-gated `GET /api/agents`. `CLIENT_URLS` includes plain `http://localhost:5173` for this
  reason too.
  `ensureLoaded()` self-heals if `npm run db:seed` truncates/regenerates the database while
  this process is still running: it checks whether a previously-cached agent id still resolves
  before every tick/start/trigger and transparently reloads if not — no restart needed after a
  reseed. `tick()` also catches its own errors so a transient DB failure can't crash the
  process via an unhandled rejection off its `setInterval`.
- **Analysis** (`modules/analysis/`): the two required AI jobs, both reusing `modules/ai` as
  one voter among several — never the sole source of truth, and never allowed to output
  "fraud" language, only "unusual"/"requires review" plus evidence and a confidence figure.
  - `liquidity.service.ts`: projects time-to-shortage per agent for cash and each provider
    independently from a recent burn rate; confidence drops when the transaction sample is
    small or has timing gaps.
  - `anomaly.service.ts`: 5-voter ensemble per agent+provider (velocity z-score,
    near-identical-amount clustering, structuring/splitting, balance reconciliation, plus one
    LLM voter) — needs ≥2 of 5 to agree before writing an alert; majority category, max
    severity, agreement-weighted confidence.
  - `analysis.service.ts` (`analyzeAgent`) runs both and is called from the simulation tick
    loop for touched agents, throttled by a 20s real-time-per-agent cooldown so LLM calls stay
    bounded regardless of simulation speed.
  - `analysis.shared.ts` has the `upsertAlert` dedup logic (updates the existing open alert
    instead of spamming new rows) and writes the first `caseEvents` "created" row, owner = the
    agent's block's ops user.
  - Routes: `GET /api/analysis/alerts` is role-scoped (agent → own alerts only, ops → own block
    only) and `POST /api/analysis/recompute` is ops-only. `PATCH /api/analysis/alerts/:id`
    (ops-only, body `{action, note?}`, action one of `acknowledge`/`escalate`/`resolve`) is the
    coordination action endpoint — 403s on a cross-block alert, always writes a `caseEvents`
    row via `applyAlertAction` in `analysis.shared.ts`.
- **Agents** (`modules/agents/`): `GET /api/agents/me` (agent role) returns the caller's own
  agent + provider balances; `GET /api/agents` (ops role) returns `{ block, agents }` — the
  caller's block's agents with balances, plus the block row for map centering.
- **Days of interest** (`modules/daysOfInterest/`): `GET /api/days-of-interest` returns global
  + the caller's own block's entries (an agent's "own block" is resolved via their
  `agents.blockId`, since agent JWTs only carry `agentId`); `POST` (ops-only) always forces
  `scope: "block"` + the caller's own `blockId`.
- **Banglish alerts**: `alerts.banglishSummary` is a deterministic template (not an LLM call)
  built in `liquidity.service.ts`/`anomaly.service.ts` and passed through `upsertAlert`.
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
- **Subdomain-based portals**: one client package serving two role-based apps, chosen at
  runtime by `App.tsx` reading `window.location.hostname`: `agent.*` → `src/apps/AgentApp.tsx`,
  `ops.*` → `src/apps/OpsApp.tsx`, anything else → `src/apps/DevPicker.tsx`. `App.tsx` checks
  `window.location.pathname` first though — `/simulator` always renders
  `src/pages/SimulatorPage.tsx` regardless of hostname (no router dependency, just this one
  special case). `vite.config.ts`
  sets `server.allowedHosts` for both subdomains. Dev requires `agent.localhost`/`ops.localhost`
  to resolve to `127.0.0.1` (see README for hosts-file fallback). Each app guards against a
  mismatched role via `src/apps/RoleMismatch.tsx`. Both apps poll their data every 15s via
  `src/lib/agentsApi.ts`/`alertsApi.ts`; `src/components/AlertList.tsx` is shared, with the
  acknowledge/escalate/resolve buttons only rendered when an `onAction` prop is passed (ops
  view), and it renders `alert.banglishSummary` under the English description when present.
  `OpsApp.tsx` additionally has `src/components/AgentMap.tsx` (`react-leaflet` + CartoDB dark
  tiles, no API key; `L.divIcon` colored-circle markers instead of default Leaflet marker
  images to sidestep the Vite bundled-asset-path issue), a `selectedAgentId` state toggling
  between block-aggregate and single-agent views, client-side search/filters (roster + alert
  volume per block are small), and `src/components/DaysOfInterestPanel.tsx` for viewing
  global+block days-of-interest and adding block-scoped ones.
- **Simulation control page** (`src/pages/SimulatorPage.tsx`, at `/simulator`): no login, talks
  directly to the public simulation routes via `src/lib/simulationApi.ts` — start/stop/speed,
  a 3s status poll, and a scenario-trigger form. Demo/judge convenience tool, not part of the
  agent/ops product surface.
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
  A JWT's `blockId`/`agentId` is fixed at login time — after `npm run db:seed` regenerates the
  database, an old token is still signature-valid but 404s (not 401s) against the new data, so
  the interceptor's auto-logout doesn't catch it. `AgentApp.tsx`/`OpsApp.tsx`'s `refresh()`
  catches this itself and force-logs-out with a toast instead of leaving the page stuck on
  "Loading..." forever.
- **Auth UI**: no signup, no Google sign-in, no modal — `src/components/LoginForm.tsx` is a
  full-page email/password form rendered by whichever app isn't authenticated yet.
  `src/lib/authApi.ts` exposes just `login`; on success components call `useAuthStore.setAuth`.
  `src/components/AppHeader.tsx` is the shared top bar (title + sign-out) for authenticated
  views.

## Environment variables

Each package has its own `.env.example` (`server/.env.example`, `client/.env.example`) plus a
root `.env.example` for `docker-compose.yml`'s Postgres credentials. See `README.md` for which
values need a free account signup (Groq, Gemini, OpenRouter) versus which are self-generated
(`JWT_SECRET`).

## Prompt log

`PROMPTS.md` at the repo root logs the prompt behind each commit (a challenge submission
requirement). Append to it — don't replace — when committing.

## Conventions

- No code comments unless documenting a genuinely non-obvious constraint.
- Don't add abstractions, config flags, or error handling for cases that can't occur yet.
- Provider separation and human-review boundaries (no fraud determinations, no automatic
  financial actions) are hard constraints from the challenge brief, not stylistic choices —
  see `Statement.md` §6/§14 before changing anything alert- or liquidity-related.
