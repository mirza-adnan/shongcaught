# ShongCaught — Judge Walkthrough

## Demo credentials

| Role | Login | Password |
|---|---|---|
| **Ops (Uttara)** | `ops.uttara@demo.local` | `OpsDemo#123` |
| **Agent (Uttara)** | `agent0001@demo.local` | `AgentDemo#123` |

Sign in at `http://localhost:5173` — one login page, role toggle is cosmetic, the real
dashboard is decided by the account. Simulation control panel (no login) is at
`http://localhost:5173/simulator`.

---

## The 30-second pitch

ShongCaught is a **multi-provider (bKash/Nagad/Rocket) decision-support layer** for mobile-money
super agents — it doesn't move money, it gives agents and their operations teams **explainable,
confidence-scored early warning** on three things: running out of cash/float, unusual
transaction behavior, and predictable demand spikes — with a full **human-in-the-loop case
workflow** on top, never an automated or "fraud-proven" verdict.

---

## 1. Role-based dashboards, one login surface

**What it is:** A single login page with an Agent/Operations toggle. The JWT carries the real
role, so the correct dashboard renders automatically — no separate portals to maintain, no way
to land on the wrong one.

**Judge talking point:** Clean **separation of concerns** between the agent's self-service view
(their own balances, their own alerts) and the ops **command-center view** (whole block, every
agent, map, coordination tools) — same auth boundary the backend enforces on every route
(`requireRole`), not just a UI convenience.

**Demo:** Log in as the agent — show the narrow, personal view. Log out, log in as ops — show
the block-wide view. Point out it's the *same* login form.

---

## 2. The simulation engine — a live digital twin

**What it is:** An in-process **virtual clock** that generates plausible transaction streams for
all 100 synthetic agents, fast-forwardable up to hundreds of times real speed, with a scenario
injector that can bias a whole block's behavior toward a specific failure mode
(`hidden_provider_shortage`, `cash_and_anomaly_spike`, `near_identical_amounts`,
`provider_feed_gap`) for a set duration.

**Judge talking point:** This is a **synthetic data generation pipeline**, not canned demo data
— every run produces fresh, statistically-shaped transaction history, so the analysis you're
about to see is reacting to data it's never seen before, live, in front of you.

**Demo:** Open `/simulator`. Start the simulation, bump speed to ~300x. Pick Uttara, trigger
`near_identical_amounts` on bKash. Watch the "Active scenarios" counter and virtual clock move.

---

## 3. Liquidity forecasting — burn-rate projection

**What it is:** For every agent, independently per provider *and* for physical cash, the system
fits a recent burn rate (net outflow per hour) and projects **time-to-shortage**. If that's
inside a 6-hour horizon, it raises a low/medium/high/critical alert with the projected balance,
sample size, and time-to-zero.

**Judge talking point:** This is **explainable forecasting**, not a black box — every alert ships
with the evidence that produced it (window size, transaction count, burn rate, largest data
gap). Confidence is **penalized for sparse or gappy data**, directly addressing the
"low-quality/stale provider feed" failure mode called out in the brief — the system tells you
when it doesn't trust its own numbers instead of pretending certainty.

**Demo:** Trigger `hidden_provider_shortage` or `cash_and_anomaly_spike` from `/simulator`, wait
a bit, refresh the ops dashboard — a liquidity alert appears with a specific "hours to zero"
projection and a confidence percentage.

---

## 4. Anomaly detection — a 5-voter ensemble

**What it is:** For every agent+provider, five independent checks vote on whether recent
activity is unusual:

1. **Velocity** — statistical z-score on transaction count vs. historical baseline.
2. **Near-identical amounts** — clustering repeated same-size transfers from a small
   counterparty set.
3. **Structuring** — many small transactions from one counterparty stacking past a threshold.
4. **Balance reconciliation** — ledger math not adding up (recorded balance ≠ previous + delta).
5. **LLM voter** — a single call to a cost-efficient model (`gpt-4o-mini` via OpenAI, with
   Groq/Gemini/OpenRouter as automatic fallback if a provider is down or rate-limited) judging
   the same evidence independently.

**≥2 of 5 must agree** before an alert is written — majority category wins, max severity, and
confidence is agreement-weighted. Never outputs "fraud" — only "unusual" / "requires review."

**Judge talking point:** This is **ensemble learning applied to responsible AI governance** —
no single signal, statistical or generative, is ever the sole source of truth. It's a
**cost-optimized architecture** too: the LLM only fires when a cheap statistical check already
fired (an LLM vote alone can never reach the 2-vote threshold, so calling it otherwise is
provably wasted spend), and results are **cached by exact prompt hash** for a few minutes to cut
real-world API cost/rate-limit exposure without sacrificing accuracy.

**Demo:** Trigger `near_identical_amounts`, wait for enough transaction volume, open an anomaly
alert, click "Show evidence" — walk through the full voter breakdown, point out which of the 5
checks fired and why, and read out the LLM's own natural-language reasoning embedded in the
alert description.

---

## 5. Block-level demand trend forecasting

**What it is:** A day-of-week demand forecaster, run per block rather than per agent. Pooling
~10-15 agents' transactions gives a real statistical sample even from limited history; the
system checks the next 7 days for a weekday that's historically run significantly busier than
average (needs at least 2 confirmed occurrences and >30% above the block's daily average)
and raises a **low-severity, forward-looking** alert — e.g. *"Elevated demand expected — Uttara
(Thursday)."*

**Judge talking point:** This directly answers "can you let agents know beforehand?" — it's
**proactive, not reactive** decision support, and it's honest about its own statistical power:
confidence scales with how many occurrences back it up, and the description explicitly says
this needs more weeks of data to get more reliable, rather than overclaiming a "monthly trend"
the data can't actually support yet.

**Demo:** Open either dashboard (agent *or* ops — it's block-wide, both roles see it) and show
the low-severity trend alert with its evidence panel (occurrences, ratio, "busier by X%").

---

## 6. Days of interest — a demand calendar

**What it is:** A shared calendar of known demand-affecting events — national holidays (Eid,
Pohela Boishakh, Ramadan, Victory Day...), a recurring month-end salary window, and block-scoped
local events an ops user can add themselves. Active entries directly bias the simulation's
transaction generation rate.

**Judge talking point:** This is the **human-curated complement** to the statistical trend
forecast above — known future demand goes straight into the calendar rather than waiting to be
statistically discovered, and it visibly changes the live simulation, not just a static list.

**Demo:** Show the Days of Interest panel on the ops dashboard; optionally add a new block-scoped
entry live.

---

## 7. Case coordination workflow

**What it is:** Every alert has an owner (the block's ops account), a status
(open → acknowledged → escalated/resolved), and a full **audit trail** (`caseEvents`) of who did
what and when. Liquidity and trend (demand-forecast) alerts reach the agent automatically —
they're informational, not an accusation, so there's no gate. Anomaly alerts are the one type
that stays human-gated: ops has to review the evidence and explicitly click "Alert agent"
before the agent sees it, since an anomaly flag should never reach someone without a person
having looked at it first. Escalating to risk/compliance is anomaly-only for the same reason
(liquidity/trend are informational, nothing to escalate); every alert type can still be
dismissed, each action writing a timestamped case event.

**Judge talking point:** This is the **human-in-the-loop safety net** the whole system is built
around — nothing here executes a real transaction or makes a final determination; every alert
ends in a human decision, with a permanent record of that decision.

**Demo:** Trigger an anomaly scenario, click the alert, walk through Alert agent → Escalate →
Dismiss, and mention the case event log backing it — then point out a liquidity or trend alert
sitting on the same dashboard with no Alert agent button at all, because it already reached the
agent on its own.

---

## 8. Validation metrics — measuring the measurer

**What it is:** A public, judge-facing endpoint/panel (`/simulator`) that classifies every alert
ever written as **scenario-driven** (fired during a deliberately triggered scenario) or
**background** (fired from pure random-walk noise) — a real, computed **false-positive-rate
proxy**, broken down by alert type and category, not a guessed number.

**Judge talking point:** This is **engineering evidence, not a vibe** — you can point at an
actual measured number instead of "trust me, it works," which is exactly the kind of
quantifiable rigor a decision-support system needs before anyone lets it near real operations.

**Demo:** Open the "Validation metrics" section on `/simulator`, point at the live-updating FPR
numbers, color-coded red/yellow/green.

---

## 9. Provider isolation & responsible-AI guardrails

**What it is:** Structural, not just cosmetic:

- Every alert is scoped to a single provider (or explicitly "physical cash") — bKash, Nagad, and
  Rocket data are never merged or cross-referenced in a way that could leak one provider's
  authority into another's.
- No OTP/PIN/password is ever collected or simulated.
- The system **never** uses the word "fraud" — every anomaly is framed as "unusual" / "requires
  review," always paired with evidence and a confidence figure.
- Bengali/Banglish plain-language summaries (`banglishSummary`) accompany every alert, generated
  deterministically from the same evidence as the English text — not an LLM call, so it's exactly
  as reliable as the numbers it's describing.

**Judge talking point:** This is **responsible-AI-by-construction**, not a policy note bolted on
afterward — the constraints are enforced in the type system and the alert-writing code path
itself, not just in a README.

---

## Suggested live demo order

1. Show `/simulator`, start the sim, trigger a couple of scenarios in Uttara.
2. Log in as **ops.uttara** — walk the map, agent table, and let alerts start appearing.
3. Open a liquidity alert → evidence → confidence.
4. Open an anomaly alert → 5-voter breakdown → LLM reasoning.
5. Point out the block-level trend alert and the Days of Interest panel.
6. Run through Alert agent → Escalate → Dismiss on an anomaly alert specifically — it's the
   only type with Alert agent/Escalate buttons; a liquidity or trend alert only ever shows
   Dismiss, since there's nothing to gate or escalate on an informational forecast.
7. Log out, log in as **agent0001** — show the liquidity and trend alerts already sitting there
   with no ops action needed (block-wide trend alert included), and show the personal balance
   view.
8. Close on the Validation Metrics panel — real measured false-positive rate, not a guess.
