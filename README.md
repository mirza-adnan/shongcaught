# ShongCaught — Super Agent Liquidity & Anomaly Prototype

A decision-support prototype for multi-provider (bKash/Nagad/Rocket) mobile-money agents: a
unified view of shared cash and per-provider e-money balances, forward-looking liquidity
pressure, explainable anomaly flags, block-level demand forecasting, and a coordinated
alert/case workflow between agents and provider operations teams. See `Statement.md` for the
full challenge brief, `Instructions.md` for the product-owner notes on top of it, and
`flow.md` for a feature-by-feature judge walkthrough (with demo credentials).

Built on a two-package starter: `server/` (Express + TypeScript API) and `client/` (React +
Vite + Tailwind + shadcn/ui).

## Key features

- **Liquidity forecasting** — per-agent, per-provider (plus physical cash) time-to-shortage
  projection from recent burn rate, with confidence penalized for sparse/gappy data.
- **Anomaly detection** — a 5-check ensemble (velocity, near-identical amounts, structuring,
  balance reconciliation, and an LLM voter) requiring ≥2/5 agreement before an alert fires.
  Never uses the word "fraud" — only "unusual"/"requires review", with evidence attached.
- **Block-level demand forecasting** — a day-of-week trend detector pooling every agent in a
  block to flag "this weekday historically runs busier" a few days ahead.
- **Case coordination** — alerts have an owner, a status workflow (open → acknowledged →
  escalated/resolved), and a full audit trail; agents can acknowledge or request support back
  to their ops team.
- **Simulation engine** — a virtual-clock transaction generator with named failure scenarios,
  controllable from the public, no-login `/simulator` page (a judge/demo convenience, not part
  of the agent/ops product surface).
- **Validation metrics** — a real false-positive-rate proxy computed from every alert ever
  written, comparing scenario-triggered vs. ambient-noise alerts (see `/simulator`).

## Structure

```
server/   Express + TypeScript API
client/   React + Vite + Tailwind + shadcn/ui
```

## Prerequisites

- Node.js 20+
- Docker (for the local Postgres database)

## Setup

1. Copy env files and fill in the values described below:

   ```
   cp .env.example .env
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

2. Start Postgres:

   ```
   docker compose up -d
   ```

   The container publishes on host port `5433` (not the default `5432`) to avoid clashing
   with a locally installed Postgres, which is common on dev machines. `DATABASE_URL` in
   `server/.env.example` already points at `5433`. If you get
   `password authentication failed` even though your `.env` looks right, check whether
   something else is already listening on the port you're using
   (`docker compose ps` should show `healthy`; if the app still can't connect, another
   Postgres instance is probably intercepting the port — either stop it or change
   `POSTGRES_PORT` and `DATABASE_URL` to a free port).

3. Install dependencies, run migrations, and seed synthetic data:

   ```
   cd server
   npm install
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

   `npm run db:seed` prints the demo agent and ops login credentials it creates.

4. In a second terminal, start the client:

   ```
   cd client
   npm install
   npm run dev
   ```

The API runs on `http://localhost:4000`. The client is a single app at
`http://localhost:5173` with one login page for both roles.

## Roles

There is no self-registration: agent and operations accounts are provisioned by
`npm run db:seed`. Everyone signs in at `http://localhost:5173` — the login page has an
Agent/Operations toggle (for clarity only; it doesn't gate anything), and after signing in you
land on the agent dashboard (cash + provider balances, alerts) or the operations dashboard
(block agents, alert coordination) based on the account's actual role.

## Environment variables you need to obtain

All variables are listed in each `.env.example`. The ones that require a free account:

- `JWT_SECRET` — any long random string you generate yourself (e.g. `openssl rand -hex 32`).
- `OPENAI_API_KEY` — API key from [platform.openai.com](https://platform.openai.com/api-keys).
  Uses `gpt-4o-mini` — cheap and fast, plenty for a short structured-JSON judgment.
- `GROQ_API_KEY` — free API key from [console.groq.com](https://console.groq.com/keys).
- `GEMINI_API_KEY` — free API key from [Google AI Studio](https://aistudio.google.com/apikey).
- `OPENROUTER_API_KEY` — free API key from [openrouter.ai](https://openrouter.ai/keys), used
  with a `:free` model so no billing is required.

The AI module tries OpenAI first, then Groq, then Gemini, then OpenRouter, falling back
automatically if a provider times out or errors. You only need one configured to get started.

## Database

Schema lives in `server/src/db/schema.ts`. After changing it:

```
npm run db:generate   # creates a migration in server/drizzle
npm run db:migrate     # applies it to the database
npm run db:seed        # wipes and reseeds synthetic blocks/agents/transactions
npm run db:studio      # browse the database in Drizzle Studio
```

## Code quality (SonarQube)

A local SonarQube instance is available via a separate compose file (kept out of the main
`docker-compose.yml` since it's a heavier, optional dev tool):

```
docker compose -f docker-compose.sonarqube.yml up -d
```

SonarQube runs at `http://localhost:9000` (default login `admin`/`admin`, changed on first
login). Scan the repo with the SonarScanner CLI (or its Docker image) using the
`sonar-project.properties` at the repo root, pointing `sonar.host.url` at that instance and
supplying a project token generated in the SonarQube UI.
