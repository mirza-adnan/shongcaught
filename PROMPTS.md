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
