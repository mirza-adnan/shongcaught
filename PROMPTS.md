Inside the AGENTS.md you find the details
regarding the template. Follow those rules. The env variables have already been set. Now we
are going to actually work on the hackathon project and build up on this template. The
Statement.md file contains the problem statement given to us and the Instructions.md contains
my thoughts on the statement. Start

[Instructions.md, in full, describing the two-role/subdomain dashboard design, synthetic
transaction data tied to phone numbers, a simulation engine with scenario injection and
fast-forward, a 5-model anomaly-voting ensemble, and the request to log prompts per commit
and add SonarQube via Docker.]

Follow-up clarifications given during planning:

For the liquidity prediction and the 5-model anomaly-voting ensemble: use rule-based
heuristics + LLM voters rather than trained ML, since theres no real dataset to train on.

For this first pass: build the foundation (data model, auth roles/subdomains, seed data,
simulation engine, AI analysis pipeline) end-to-end with minimal UI, before building the two
full dashboards.

Checkpoint 2 (role-based auth + subdomain client scaffolding):

okay you can continue

Checkpoint 3 (simulation engine: virtual clock, transaction generator, scenario injection,
ops-only routes):

okay you can continue. Also update the claude.md as you go for local memory

Checkpoint 4 (AI analysis pipeline: liquidity burn-rate projection, 5-voter anomaly ensemble,
wired into simulation ticks, ops-only recompute + role-scoped alert listing routes):

okay continue

Checkpoint 5 (minimal smoke-test UI: agents module, alert action endpoint, agent + ops
dashboards):

yep go on

Bugfix (simulation engine's in-memory agent cache going stale after an independent db:seed
while the server keeps running, discovered during a live test walkthrough):

yea do that

Next pass, Checkpoint 6 (server additions: block info on agent listing, Banglish alert
summaries, days-of-interest module) — planned and approved after two clarifying questions
(map library choice, and which remaining work to prioritize next):

okay now continue with the work

Fixed a second occurrence of the stray-dev-process issue (same symptom class as the earlier
bugfix — confusing 404s traced to zombie node processes, not application code) after a report
of GET /api/agents 404ing in the browser:

okay its wokring now. can you implement a ui for the simulator at a public route

Follow-up clarification (whether the new /simulator control page should require ops login or
be fully open):

No login required

Three bugs reported together after trying the /simulator page: white-on-white dropdown text,
a request to select an operations team/block instead of a single agent for scenario
injection (so the whole block's agents receive simulated transactions), and the ops dashboard
going blank after an app restart (needing logout/login to recover) — plus a request for a demo
walkthrough once fixed:

the options in the dropdowns arent visible since it is white text on white background. Also
instead of agents, let me select a particular operation team and the agents within that block
will receive simulated transactions. Also everytime i restart the app, the operations
dashboard is blank and i have to logout and log back in to get the page back. Afer youre done
doing these, give me a walkthrough of how to demo this

Feasibility question on adding ML (RandomForest/IsolationForest) to the anomaly ensemble —
answered with a recommendation (Isolation Forest as an unsupervised 6th voter) rather than
building immediately:

okay so we already have a pretty big collection of transactions in our db. can we fit a
RandomForest or IsolationForest model to the data to improve our anomaly detection?

LLM call volume/cost investigation, leading to two optimizations: skip the LLM voter entirely
when no cheap voter already fired (it could never reach the 2/5 threshold alone), and cache
LLM results by exact prompt hash instead of a hand-picked row signature:

Right now, how often are the data being to check for anomalies. Is it for every transaction?
We should probably try to optimize this because this will burn limits like crazy

yes add prompt caching

wouldnt it be better if you hashed the prompt and used that as key? or is that already
happening

Clarified the anomaly ensemble's actual architecture (4 deterministic checks + 1 LLM call, not
5 models), then built a 3-model consensus sub-ensemble (Groq+Gemini+OpenRouter queried in
parallel, majority vote) for the LLM voter for redundancy against rate limits, and surfaced the
LLM's reasoning in the alert description:

right now what types of anomalies are we detecting?

so each model is analyzing something different? I would say we should send all the data to the
models and let them vote whether overall anything looks suspicious. And the alert should also
include a reason for flagging from the llm

what do you mean 1 llm voter? Dont we have a voting between 5 models?

okay i like the 4 deterministic checks. On top of that i think we should have 3 different
models vote on it and return a verdict.

Roadmap discussion leading to three additions: a scenario-tagged false-positive-rate metrics
endpoint/panel, a restored Escalate action, and a scenario-origin filter/badge on the ops
dashboard:

given the state of the application right now, what features would you add now

do 1,2 and 4

Full UI/UX overhaul: merged agent/ops login into a single page with a role toggle (retiring
subdomain-based routing), rebranded as "ShongCaught", redesigned the navbar and fixed the
avatar dropdown's horizontal cutoff, consistent button/input/select padding and a red/yellow/
green/grey status palette, and a two-column ops dashboard layout:

okay can we improve the UI now. The buttons that are too thin need more padding. You can use
status colors like red, yellow, green and shades of grey alongside the accent. Instead of two
subdomains, just have their login page in the same page. The login role will be toggleable.
That page should contain the name of the app "ShongCaught". Just make the overall page nicer.
The navbar needs more. The profile icon you can click to logout, its the content cutsoff
horizontally. The items in the ops page can be put in different places. Just make all the
pages look good in terms of UI and UX

Added more global days-of-interest entries, then built a block-level day-of-week demand
forecast (a new "trend" alert type, pooling agents for a real sample since one agent's history
is too sparse) — which surfaced and fixed a genuine bug where naive `timestamp` columns
round-tripped inconsistently through the local timezone, silently shifting every timestamp on
read:

You should probably add more global days of interest. Is it possible to analyze monthly
transaction trends and let the agents know beforehand?

instead of doing it on an agent basis, it would probably be to analyze the trend over a block

sure

Judge-facing walkthrough document, written with credentials up front and buzzword-heavy talking
points per feature:

can you generate a flow.md file that will contain how each core feature works. Write it in a
way i can explain to the judges. try to use buzzwords. The beginning of the file should contain
credentials for uttara ops and one agent from uttara

Bugfix (dev server wasn't running — a recurring "connection refused" symptom from stopping the
server after verification, not an application bug):

On the ops dashboard, put the alerts in its own container which will itself be scrollable. Make
the scrollbar thin and minimal. And fix the sizing issue. The dismiss button is going out of the
container. Also the elevated demand alert doesnt need an escalate button. And there should only
be only one instance of such demand alerts. Clicking alert agent will alert all the agents in
the block. Also make the cursor pointer on the buttons on the alert.

Reverted the 3-model anomaly-voter ensemble back to a single-call design now that a fresh OpenAI
key was available, using a cost-efficient model with the older providers kept as fallback:

okay all of the ai models are getting timeout. i added an openai api key and it should hold out
for a while. how about you remove the 3 model voting and and return to the one model system
with the open ai api now. Use a limit efficient model

Bugfix (agents could see ops alerts before ops had actually notified them — added a
status-gate so agents only see alerts once acted on) plus confirmation that the LLM-skip
optimization from earlier was still intact after the ensemble revert:

For some reason, the agents dashboard is showing the alerts even if the ops hasnt alerted them
yet. Also to save on api usage, only send the request to the llm if one or more of the rules
based checks return true

Agent dashboard overhaul: recent-transaction feed, read-only days-of-interest panel,
color-coded balance cards with a prominent liquidity countdown, new-alert toasts, an
agent-side Acknowledge action (removes an alert from just the agent's own view without
touching ops's coordination state) and a Request Support action back to ops:

what do you think we should add to the agent dashboard? it seems a bit barebones. What
features can you think of

All of these sound good. Also add an acknowledge button to the alerts so agents can remove
them once notified
