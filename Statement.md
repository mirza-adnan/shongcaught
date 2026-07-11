## 1. Executive Summary

Many mobile financial service agents serve customers through more than one provider, such as bKash, Nagad, and Rocket. They use one pool of physical cash, but each provider has a separate e-money balance. This makes it hard to see the full situation. An agent may have enough total value but still be unable to serve customers because one provider balance or the shared cash reserve is running low. The challenge is to build a working prototype that gives a clear combined view, warns about possible shortages, highlights unusual activity, and helps the right people coordinate a safe response.

Build a safe decision-support prototype that helps a multi-provider "super agent" and the relevant provider teams understand liquidity pressure, cross-provider imbalance, unusual transaction behavior, and who should coordinate the response - without claiming fraud, merging real wallets, or executing financial actions.

## 2. Background and Context

Imagine an agent shop in a busy market on the afternoon before Eid. The shop serves bKash, Nagad, and Rocket customers. It has one physical cash drawer, but three separate e-money balances. Cash-out requests suddenly increase. The agent can see each provider separately, but cannot easily answer a simple question: will the shop have enough cash and provider balance to continue serving customers for the next few hours?

Now the situation becomes more difficult. Most of the pressure is coming from one provider. Several transactions have almost the same amount and come from a small group of accounts. This may be normal Eid demand, a data problem, or activity that needs review. At the same time, the agent, field officer, provider operations team, and risk reviewer may not know who should act first or how the issue should be followed until it is resolved.

## 3. Problem Statement

Build and demonstrate a prototype that helps multi-provider agents and the relevant provider teams understand three connected problems: upcoming liquidity shortage, unusual transaction or balance behavior, and operational coordination. The prototype should make the situation easy to understand, show the evidence behind important alerts, identify the responsible stakeholder, and support safe human decisions. It must not execute real transactions or make a final fraud decision.

## 4. Challenge Objectives

## Primary objectives

- Provide a unified operational view of physical cash and separate provider-specific e-money positions.

- Identify provider-level and aggregate liquidity pressure before service is disrupted.

- Surface unusual transaction or balance behavior with understandable evidence and uncertainty.

- Support clear coordination by identifying the responsible stakeholder, escalation path, case owner, and resolution status for important liquidity or anomaly alerts.

- Help users distinguish operational demand spikes, data-quality problems, and patterns requiring review.

- Demonstrate measurable analytical and engineering quality through a working prototype.

## Secondary objectives

- Support multi-agent, area-wise, provider-wise, or time-wise prioritization.

- Provide clear Bengali, Banglish, or English explanations for different stakeholders.

- Show safe fallback behavior when provider data is incomplete, inconsistent, or delayed.

- Preserve provider separation and avoid implying unauthorized conversion between provider balances.

## Optional advanced objectives

- Explore cross-provider pattern insight or network relationships using simulated identifiers.

- Support what-if scenarios for provider demand, local events, or agent unavailability.

- Show human review, case notes, feedback, or audit trails.

- Explore advanced coordination such as nearby-agent support discovery, alert assignment, acknowledgement, escalation timelines, case notes, resolution tracking, hotspot mapping, or graph-based relationship insight.

## 5. Intended Users and Stakeholders

## Operations role definition for this challenge

In this challenge, "Operations Team" means the people who help agents continue serving customers. This is a general challenge role, not the official organization structure of any provider.

A simple example of the hierarchy is: agent or outlet $ \rightarrow $ field or territory officer $ \rightarrow $ area, thana, or district manager $ \rightarrow $ central provider operations team. Actual structures may be different.

Their daily work may include checking agent service status, reviewing low-balance or unusual-activity alerts, contacting agents, arranging support through approved channels, assigning cases, recording updates, and escalating suspicious cases to a risk or compliance team.

For a Super Agent, each provider keeps its own operations process, rules, and data boundary. A prototype may show one combined outlet view, but it must not suggest that one provider can control another provider's balance, data, or decisions.

<table border="1"><tr><td>Stakeholder</td><td>Need or challenge</td></tr><tr><td>Multi-provider agent</td><td>See physical cash and each provider balance together, understand upcoming pressure, and know what action may be needed.</td></tr><tr><td>Provider operations / network coordination team</td><td>Monitor assigned agents, review important alerts, contact the correct agent or field officer, coordinate approved support, and track the case until closure.</td></tr><tr><td>Risk or compliance analyst</td><td>Review unusual activity using evidence and context. Operations teams may escalate a case, but they should not make the final fraud decision.</td></tr><tr><td>Financial service provider</td><td>Understand provider-specific service pressure while keeping provider data and authority separate.</td></tr><tr><td>Management</td><td>See area-level service risk, recurring problems, and overall operational readiness.</td></tr><tr><td>Customers</td><td>Receive more reliable service from their preferred provider.</td></tr></table>

## 6. Scope of the Challenge

## In scope

- A simulated agent ecosystem with at least two logically separate financial service providers.

- Shared physical cash and provider-specific electronic balances.

- Provider-aware demand, liquidity risk, projected service pressure, and confidence.

- Anomaly or risk indicators based on transaction, timing, balance, area, or behavioral signals.

- Human-review workflows, explanations, evidence, and safe operational recommendations.

- Provider-aware coordination workflows covering alert routing, ownership, acknowledgement, escalation, authorized support requests, and resolution tracking.

- Web, Android, or combined prototype interfaces for agents and/or operations users.

- Testing, monitoring, evaluation, and documented limitations.

## Out of scope

- Real interoperability, settlement, or conversion between bKash, Nagad, Rocket, or other wallets.

- Access to production APIs, real customer identities, real balances, or real transaction accounts.

- Automatic blocking, accusation, disciplinary action, or final fraud determination.

- Unauthorized cash movement, wallet refill, transfer, recovery, or reversal.

- Collection of credentials, PINs, OTPs, passwords, or private authentication data.

- Claims of regulatory approval or production fraud-detection readiness.

## 7. Functional Expectations

<table border="1"><tr><td>Priority</td><td>Expected capability</td></tr><tr><td>Mandatory</td><td>Show shared physical cash and separate balances for each provider.</td></tr><tr><td>Mandatory</td><td>Show which provider or shared cash reserve may face a shortage and approximately when.</td></tr><tr><td>Mandatory</td><td>Detect at least one type of unusual activity and show why it was flagged.</td></tr><tr><td>Mandatory</td><td>Use careful language such as “unusual” or “requires review”; do not declare fraud.</td></tr><tr><td>Mandatory</td><td>For at least one important alert, show who receives it, who owns it, the recommended next step, and the final status.</td></tr><tr><td>Mandatory</td><td>Show lower confidence or a safe fallback when data is missing, late, or conflicting.</td></tr><tr><td>Mandatory</td><td>Use AI, APIs, analytics, or data processing as a meaningful part of the product.</td></tr><tr><td>Recommended</td><td>Allow users to filter or prioritize by provider, agent, area, or time.</td></tr><tr><td>Recommended</td><td>Provide evidence and a simple history for important alerts.</td></tr><tr><td>Recommended</td><td>Offer clear Bengali, Banglish, or English explanations.</td></tr><tr><td>Recommended</td><td>Show at least one simple Bengali or Banglish alert with the situation, evidence, uncertainty, and a safe next step.</td></tr><tr><td>Optional</td><td>Optionally support simulations, peer comparison, relationship views, or cross-provider patterns.</td></tr><tr><td>Recommended</td><td>Support provider-specific escalation, case notes, alert history, and coordination while keeping provider boundaries clear.</td></tr><tr><td>Optional</td><td>Teams may independently select and implement one or more relevant fraud or anomaly-detection scenarios.</td></tr></table>

<table border="1"><tr><td>Priority</td><td>Expected capability</td></tr><tr><td></td><td>They are free to define the pattern, detection approach, evidence, and review workflow, provided the scenario uses simulated or anonymized data, is clearly documented and evaluated, and does not present an anomaly score as proof of fraud.</td></tr></table>

## 8. Non-Functional Expectations

<table border="1"><tr><td>Area</td><td>Expectation</td></tr><tr><td>Usability</td><td>Provider distinctions, shared cash exposure, and risk signals must be easy to understand.</td></tr><tr><td>Performance</td><td>Core analytical and dashboard interactions should be responsive under the demonstrated data volume.</td></tr><tr><td>Reliability</td><td>Provider data failures or inconsistencies should not silently produce confident conclusions.</td></tr><tr><td>Explainability</td><td>Every high-impact alert should expose the reason, relevant evidence, and uncertainty.</td></tr><tr><td>Security and privacy</td><td>Use synthetic identifiers and avoid real credentials, customer identities, or sensitive account data.</td></tr><tr><td>Fairness and responsible AI</td><td>Avoid unsupported profiling and demonstrate human review for risk judgments.</td></tr><tr><td>Auditability</td><td>Important alerts, ownership changes, acknowledgements, escalations, evidence, and resolution actions should be traceable.</td></tr><tr><td>Interoperability</td><td>The prototype should represent multiple providers without assuming real technical integration.</td></tr></table>

## 9. Data and Assumptions

Teams should use realistic synthetic, mock, anonymized, or safe public data. The data may include agent and provider IDs, area, time, transaction type, amount, status, opening and current balances, event flags, and case status. Teams must clearly explain how the data was created, what assumptions were made, and what limitations remain.

## Risk interpretation rule

Participants are encouraged to explore fraud or anomaly patterns of their own choosing, such as unusual transaction velocity, repeated or near-identical amounts, transaction splitting, circular activity, balance inconsistencies, location or time anomalies, abnormal failure rates, or another well-justified pattern. Teams are not required to use these examples and may propose different detection categories. The chosen scenario, assumptions, evidence, validation method, expected false positives, and human-review boundary must be explained.

An anomaly is not proof of fraud. Teams should document which behaviors are simulated, what a flag means, the expected false-positive risk, and what human review would be required before any real-world action.

## Participant flexibility note

## 10. Required Deliverables

<table border="1"><tr><td>Deliverable</td><td>What judges should see</td></tr><tr><td>Working prototype</td><td>A live flow showing multi-provider balances, a liquidity or anomaly alert, and how one important case is coordinated or escalated.</td></tr><tr><td>Source repository</td><td>Source code, README, setup steps, environment examples, and sample data.</td></tr><tr><td>Architecture diagram</td><td>Main interfaces, backend, data flow, analytics or AI services, monitoring, provider boundaries, and alert coordination flow.</td></tr><tr><td>Data and simulation note</td><td>How the synthetic provider data and anomaly scenarios were created, including assumptions and limitations.</td></tr><tr><td>Validation evidence</td><td>At least three measured metrics covering analytics, system performance, or reliability.</td></tr><tr><td>Responsible-design note</td><td>Privacy, human review, false positives, advisory boundaries, and actions the prototype intentionally does not perform.</td></tr><tr><td>Final presentation</td><td>Problem, users, story-driven demo, architecture, metrics, coordination flow, risks, limitations, and next steps.</td></tr></table>

## Optional supporting materials

- Short demonstration video.

- Alert case study or review log.

- Load-test, profiling, or trace outputs.

- Additional multi-provider scenarios or relationship visualizations.

## 11. Expected Demonstration Scenarios

The following examples are included only to make the task easier to understand. Teams may use different wording logic, interfaces, and analytical methods. These examples are advisory messages, not financial commands.

## Scenario A - Hidden provider shortage

A multi-provider agent appears healthy when all balances are added together, but one provider's e-money is about to run out. The prototype should clearly show which provider is under pressure, when the shortage may happen, how certain the estimate is, and what safe next step is suggested.

## Illustrative Bangla alert - liquidity pressure

বটসাব (লেবডেবর ধারা অনুমোদী বিকল্প ছোট ২০ মিনিটের মধ্যে আপসাবর বগণ তাকা পশ্চ হয়ে মধ্যে পা�ার। সবচেয়ে (বশি চাপ আপসাবে বিকাস ক্যাল-আটট (থাক) বিরাপত্তাবল (সবা চাপ ব্যবহৃত ক্যালখেত কমপথক ২০,০০০ তাকা অতিরিক্ত বগণ ব্যবহৃত করার পরামর্শ (তদের হয়ে)

This is an illustrative output only. Teams may use different wording, logic, interface, or analytical approach.

## Scenario B - Liquidity pressure with unusual activity

The agent's physical cash is falling quickly and one provider shows a sudden rise in repeated or high-value transactions. The prototype should show both the liquidity risk and the unusual pattern, explain possible normal reasons, and recommend human review before major action.

## Illustrative Bangla alert - unusual activity requiring review

গঠ ১২ মিলিটে স্থানাবিকর তুলনায় আলক (বিশ কাস্স-আটট স্থানেও) কমেন্টিত (লেনদেবর পরিষদাল স্থান একই পব্ত জায় কমেন্টিত আগাকাটনে) থাকে বারবার আনুরোধ পব্তেও) প্রিট সেন-পুবর স্থানাবিক তাহিদান স্থান পারে, তাবে বছর আকর্ষ নগর পুবররায় সরবরায়ের আগে (লেনদেবলা পব্তালাগনা করা স্থানাজন)

This is an illustrative output only. Teams may use different wording, logic, interface, or analytical approach.

## Scenario C - Cross-provider or data inconsistency

Different provider feeds arrive late or show conflicting balances. The prototype should warn the user about the data problem, reduce confidence, keep provider balances separate, and avoid giving a misleading recommendation.

## Scenario D - Coordinated response and closure

A high-priority liquidity or anomaly alert affects one provider. The prototype should show who receives the alert, who owns it, what action is recommended, whether it was acknowledged, and whether the issue was resolved or escalated.

## 12. Success Criteria and Engineering Evidence

- The product demonstrates meaningful multi-provider insight rather than merely placing separate charts on one screen.

- Liquidity and anomaly outputs are connected, explainable, and safe for human decision support.

- Important alerts lead to a clear and traceable coordination path rather than ending as passive dashboard notifications.

- Provider boundaries and real-world integration limits are clearly respected.

- False positives, uncertainty, and data-quality failure modes are acknowledged and tested.

- The prototype presents measurable analytical and system evidence end to end.

<table border="1"><tr><td>Possible metric</td><td>Example evidence</td></tr><tr><td>Provider-level demand or balance error</td><td>Validation on held-out simulated provider scenarios.</td></tr><tr><td>Shortage detection lead time</td><td>How early provider or shared-cash pressure is detected.</td></tr><tr><td>Anomaly precision and recall</td><td>Evaluation against intentionally injected simulated cases.</td></tr><tr><td>False-positive rate</td><td>Normal salary-day or Eid scenarios incorrectly flagged for review.</td></tr><tr><td>Alert explanation coverage</td><td>Percentage of alerts with reason, evidence, and uncertainty.</td></tr><tr><td>API or processing latency</td><td>Average and percentile timing at a documented agent or transaction volume.</td></tr><tr><td>Reliability and observability</td><td>Behavior, logs, metrics, or traces during delayed, missing, or inconsistent provider input.</td></tr></table>

## 13. Evaluation Criteria

Because the problem is already defined, judges will focus mainly on how well the team understands the problem, builds the prototype, validates the analytics, handles uncertainty, and demonstrates the complete workflow.

<table border="1"><tr><td>Category</td><td>Weight</td><td>What judges evaluate</td></tr><tr><td>Problem understanding and ecosystem relevance</td><td>15%</td><td>Clarity of multi-provider operations, user roles, coordination responsibilities, provider boundaries, and documented assumptions.</td></tr><tr><td>Innovation and decision value</td><td>20%</td><td>Quality and originality of unified liquidity, anomaly, and human decision-support insight.</td></tr><tr><td>Technical implementation and integration quality</td><td>25%</td><td>End-to-end completeness, software quality, component integration, alert routing or case workflow, robustness, reliability, and demonstrable engineering depth.</td></tr><tr><td>Data and analytical quality</td><td>20%</td><td>Realism of simulated data, validation method, uncertainty handling, anomaly evidence, and false-positive awareness.</td></tr><tr><td>User experience and explainability</td><td>10%</td><td>Clarity and usefulness for agents, provider operations users, outlet coordinators, and risk reviewers, including ownership, next steps, and status visibility.</td></tr><tr><td>Security, privacy, fairness, and responsible design</td><td>5%</td><td>Provider boundaries, human review, data safety, careful risk language, and prevention of unsafe financial actions.</td></tr><tr><td>Presentation and demonstration</td><td>5%</td><td>Live end-to-end flow, coherent narrative, measured evidence, and honest treatment of limitations.</td></tr></table>

## 14. Constraints and Guardrails

- Represent providers as logically separate systems; do not imply unauthorized conversion or settlement.

- Do not connect to or control real wallets, balances, customer accounts, or financial infrastructure.

- Do not request PINs, OTPs, passwords, private keys, or other sensitive credentials.

- Risk signals are advisory and must support human review; the prototype must not make final fraud determinations.

- Do not automatically block users, freeze funds, accuse agents, or initiate financial actions.

- Coordination features may notify, assign, escalate, recommend, and track; they must not bypass provider authorization, expose another provider's confidential data, or automatically transfer liquidity.

- Document assumptions, synthetic patterns, test conditions, limitations, and expected false positives.

- Prioritize a coherent, demonstrable scope over unsupported production claims.

## 15. Innovation Opportunities

- Provider-aware liquidity planning.

- Cross-provider operational context.

- Explainable anomaly and risk evidence.

- Human review and feedback loops.

- Provider-aware alert ownership, escalation, and resolution workflows.

- Area or network hotspots.

- Context-aware distinction between legitimate spikes and suspicious patterns.

- Inclusive agent-side communication.

- Privacy-preserving synthetic data design.

- Scalable monitoring and traceability.

## 16. Submission Checklist

- At least two provider contexts represented distinctly.

- Shared cash and provider-specific balances demonstrated.

- Forward-looking liquidity insight demonstrated.

- At least one anomaly category demonstrated with evidence.

- Human-review and careful risk language included.

- At least one alert demonstrates routing, ownership, acknowledgement or escalation, and a visible resolution status.

- Repository, data, README, and architecture complete.

- At least three metrics measured and explained.

- Failure, uncertainty, and false-positive considerations shown.

- Safety, privacy, boundaries, and limitations stated.

- Final presentation ready.

## 17. Closing Statement

The strongest submissions will make a complex multi-provider situation simple to understand. They will connect liquidity insight, unusual-activity evidence, and clear coordination without unsafe integration, unsupported accusations, or automatic financial action.
