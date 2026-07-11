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
