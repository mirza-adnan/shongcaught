# Architecture

ShongCaught is two independent npm packages (`server/`, `client/`) plus a standalone,
not-wired-in `ml/` reference script — no shared workspace, no shared code. See `CLAUDE.md` for
file-level detail and `flow.md` for a feature-by-feature walkthrough.

## System overview

```mermaid
flowchart TB
    subgraph ClientApp["client — React + Vite + Tailwind + shadcn/ui"]
        LoginPage["Login Page\n(Agent/Ops toggle, cosmetic only)"]
        AgentDash["Agent Dashboard"]
        OpsDash["Ops Dashboard"]
        SimPage["/simulator\n(public, no auth)"]
    end

    subgraph ServerApp["server — Express + TypeScript"]
        AuthMod["auth\nJWT issue + requireAuth/requireRole"]
        AgentsMod["agents\nself/block balances + tx feed"]
        DOIMod["daysOfInterest\nglobal/block demand calendar"]
        SimMod["simulation\nvirtual clock + named scenarios"]

        subgraph AnalysisMod["analysis"]
            Liquidity["liquidity.service.ts\nburn-rate → time-to-shortage"]
            Anomaly["anomaly.service.ts\n4 deterministic checks + 1 LLM voter,\n>=2/5 agreement to alert"]
            Trend["trend.service.ts\nblock-pooled day-of-week forecast"]
            Shared["analysis.shared.ts\nupsertAlert / case coordination"]
        end

        AIMod["ai\nprovider fallback chain"]
    end

    DB[("Postgres\nblocks · agents · transactions ·\nalerts · caseEvents · daysOfInterest")]

    subgraph AIProviders["External LLM APIs"]
        OpenAI
        Groq
        Gemini
        OpenRouter
    end

    ML["ml/train_isolation_forest.py\nreference only — not imported,\nnot scheduled, not run in CI"]

    LoginPage -->|POST /auth/login| AuthMod
    AgentDash -->|"/agents/me, /agents/me/transactions,\n/analysis/alerts, agent-ack, request-support"| ServerApp
    OpsDash -->|"/agents, /analysis/alerts,\nacknowledge/escalate/resolve"| ServerApp
    SimPage -->|start/stop/speed/trigger| SimMod

    AuthMod --> DB
    AgentsMod --> DB
    DOIMod --> DB
    SimMod -->|writes synthetic transactions| DB
    SimMod -->|per-agent + per-block cooldowns| AnalysisMod
    Liquidity --> DB
    Anomaly --> DB
    Trend --> DB
    Anomaly -->|only if a cheap check already fired| AIMod
    Shared --> DB
    AIMod -->|first configured, first success wins| AIProviders

    ML -.->|manual, offline reads| DB
```

**Why this shape:** the simulation engine is the only thing that writes transactions, so it's
the sole trigger for analysis — nothing polls or schedules separately. The analysis module
never calls an AI provider unless a cheap deterministic check already fired (an LLM vote alone
can never reach the 2-of-5 threshold), which is what keeps LLM spend and rate-limit exposure
bounded. `ml/` is drawn with a dashed line deliberately — it's a reference sketch from a design
discussion, not a live dependency.

## Alert lifecycle (liquidity/anomaly detection → case coordination)

```mermaid
sequenceDiagram
    participant Sim as Simulation Engine
    participant DB as Postgres
    participant An as Analysis Pipeline
    participant AI as LLM Provider
    participant Ops as Ops Dashboard
    participant Agent as Agent Dashboard

    Sim->>DB: insert synthetic transactions (virtual clock tick)
    Sim->>An: analyzeAgent(agentId) / analyzeTrend(blockId)
    An->>DB: read recent transaction window
    An->>An: run 4 deterministic checks
    alt any check fired
        An->>AI: ask for an independent judgment
        AI-->>An: fired / category / severity / rationale
    end
    An->>DB: upsertAlert (status = open)

    Ops->>DB: GET /analysis/alerts (sees it, status = open)
    Ops->>DB: PATCH acknowledge ("Alert agent")

    Agent->>DB: GET /analysis/alerts (now visible — hidden while status was open)
    Agent->>DB: PATCH agent-ack (removes it from their view only, ops's status/audit trail untouched)
```

This is the same loop for all three alert types (`liquidity`, `anomaly`, `trend`) — the only
difference is what triggers `upsertAlert` and whether `agentId` is set (`trend` alerts are
`agentId: null`, block-scoped, visible to every agent in that block once ops acts on them).

## Data model

`blocks` (operational areas) → `agents` (shop entities, distinct from `users`/login accounts) →
`agentProviderBalances` (one row per agent per provider) → `transactions` (the event log
everything derives from) → `alerts` (liquidity/anomaly/trend, with evidence/confidence/status/
owner) → `caseEvents` (the full audit trail: created, acknowledged, escalated, resolved, agent
notes). `daysOfInterest` is a separate, human-curated calendar that biases simulation
generation directly, independent of the statistical `trend` forecaster.
