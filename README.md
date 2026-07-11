# Hackathon Template

A modular starting point for hackathon projects: Express + TypeScript API, React + Vite
frontend, Postgres via Drizzle ORM, JWT + Google auth, and an AI module with automatic
provider fallback.

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

3. Install dependencies and run migrations:

   ```
   cd server
   npm install
   npm run db:generate
   npm run db:migrate
   npm run dev
   ```

4. In a second terminal, start the client:

   ```
   cd client
   npm install
   npm run dev
   ```

The API runs on `http://localhost:4000`, the client on `http://localhost:5173`.

## Environment variables you need to obtain

All variables are listed in each `.env.example`. The ones that require a free account:

- `JWT_SECRET` — any long random string you generate yourself (e.g. `openssl rand -hex 32`).
- `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` — create an OAuth 2.0 Client ID at
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (free). Set the
  authorized JavaScript origin to `http://localhost:5173`. Use the same client ID in both
  `server/.env` and `client/.env`.
- `GROQ_API_KEY` — free API key from [console.groq.com](https://console.groq.com/keys).
- `GEMINI_API_KEY` — free API key from [Google AI Studio](https://aistudio.google.com/apikey).
- `OPENROUTER_API_KEY` — free API key from [openrouter.ai](https://openrouter.ai/keys), used
  with a `:free` model so no billing is required.

The AI module tries Groq first, then Gemini, then OpenRouter, falling back automatically if a
provider times out or errors. You only need one configured to get started.

## Database

Schema lives in `server/src/db/schema.ts`. After changing it:

```
npm run db:generate   # creates a migration in server/drizzle
npm run db:migrate     # applies it to the database
npm run db:studio      # browse the database in Drizzle Studio
```
