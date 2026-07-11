# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

A two-package hackathon starter: `server/` (Express + TypeScript API) and `client/` (React +
Vite + Tailwind + shadcn/ui). They are independent npm projects, not a workspace/monorepo —
run commands from inside each directory.

## Commands

### Server (`server/`)

```
npm run dev          # tsx watch src/server.ts, http://localhost:4000
npm run build         # tsc -> dist/
npm run start          # run compiled dist/server.js
npm run db:generate    # drizzle-kit generate — creates a migration from schema.ts
npm run db:migrate     # drizzle-kit migrate — applies migrations to DATABASE_URL
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
docker compose up -d   # starts Postgres only (root docker-compose.yml)
```

## Architecture

### Server

Module-per-feature under `src/modules/<name>/`, each with `*.routes.ts` → `*.controller.ts`
→ `*.service.ts`. Routes are mounted in `src/routes/index.ts` under `/api`, which is mounted
in `src/app.ts`. `src/server.ts` just calls `app.listen`.

- **Env**: `src/config/env.ts` parses `process.env` through a Zod schema at import time and
  throws if required vars are missing. Every module imports `env` from here rather than
  touching `process.env` directly.
- **DB**: `src/db/index.ts` exports a single `db` (drizzle + postgres-js) built from
  `DATABASE_URL`. Schema lives in `src/db/schema.ts`; run `db:generate` after editing it and
  commit the resulting SQL file in `drizzle/`.
- **Auth** (`modules/auth/`): manual signup/login hashes passwords with bcryptjs and issues a
  JWT (`utils/jwt.ts`). Google sign-in (`google.ts`) verifies an ID token the client obtained
  via Google Identity Services — the server never handles an OAuth redirect/session, it only
  verifies tokens against `GOOGLE_CLIENT_ID`. `requireAuth` middleware reads
  `Authorization: Bearer <jwt>` and sets `req.userId`.
- **AI** (`modules/ai/`): `ai.service.ts` calls providers in `providers/` in order
  (Groq → Gemini → OpenRouter) via `generateText()`, each wrapped in a timeout
  (`PROVIDER_TIMEOUT_MS`). It moves to the next provider on any error or timeout and returns
  which provider actually served the response. Providers are skipped if their API key isn't
  set (`isConfigured()`). To add a provider: implement the `AiProvider` interface in
  `types.ts` and push it into `PROVIDER_CHAIN`.
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
- **HTTP**: single axios instance in `src/lib/axios.ts` with `baseURL` from
  `VITE_API_URL`. It auto-attaches the Zustand auth token as a Bearer header and clears auth
  state on a 401 response. Import `api` from there rather than creating new axios instances.
- **Auth UI**: `Navbar` renders a "Sign in" button (unauthenticated) or an avatar dropdown
  with sign-out (authenticated), driven by `useAuthStore`. The button opens `AuthDialog`,
  which contains `GoogleLoginButton` plus tabbed manual sign-in/sign-up forms. Request
  functions live in `src/lib/authApi.ts` (`login`, `signup`, `loginWithGoogle`) — all just
  thin wrappers over `api` that return `{ user, token }`; on success components call
  `useAuthStore.setAuth`. `GoogleLoginButton` renders nothing if `VITE_GOOGLE_CLIENT_ID` is
  unset, and lazily waits for the Google Identity Services script (loaded in `index.html`,
  `https://accounts.google.com/gsi/client`) before initializing. GIS types are declared
  ad-hoc in `src/lib/google.d.ts` — extend that if you use more of the API surface.

## Environment variables

Each package has its own `.env.example` (`server/.env.example`, `client/.env.example`) plus a
root `.env.example` for `docker-compose.yml`'s Postgres credentials. See `README.md` for which
values need a free account signup (Groq, Gemini, OpenRouter, Google OAuth client ID) versus
which are self-generated (`JWT_SECRET`).

## Conventions

- No code comments unless documenting a genuinely non-obvious constraint.
- Don't add abstractions, config flags, or error handling for cases that can't occur yet —
  this is a starter template meant to stay small and be built up incrementally.
