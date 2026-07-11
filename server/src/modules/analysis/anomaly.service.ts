import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, type AlertSeverity, type AnomalyCategory, type Provider } from "../../db/schema.js";
import { generateText } from "../ai/ai.service.js";
import { abstain, type VoterResult } from "./analysis.types.js";
import { getLatestTransactionTime, getRecentTransactions, upsertAlert } from "./analysis.shared.js";

const WINDOW_HOURS = 6;
const HISTORY_HOURS = 24 * 5;
const PROVIDERS: Provider[] = ["bkash", "nagad", "rocket"];
const SEVERITY_RANK: Record<AlertSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const ALLOWED_CATEGORIES: AnomalyCategory[] = [
  "velocity",
  "near_identical_amounts",
  "structuring",
  "circular",
  "balance_inconsistency",
  "other",
];
const ALLOWED_SEVERITIES: AlertSeverity[] = ["low", "medium", "high", "critical"];
const CATEGORY_SPECIFICITY: Record<AnomalyCategory, number> = {
  near_identical_amounts: 2,
  structuring: 2,
  circular: 2,
  balance_inconsistency: 2,
  velocity: 1,
  other: 0,
};

// "velocity" just means "more activity than usual" and fires alongside almost any other
// pattern (every injected scenario also raises transaction volume) — when it ties with a more
// specific category on vote count, the specific one is more useful to a reviewer and should
// win, rather than an arbitrary tiebreak by confidence (velocity's confidence cap is
// structurally close to the others', so it would otherwise win most ties by a hair). Shared by
// the outer 5-check ensemble and the inner 3-model LLM sub-ensemble below, which both need to
// pick one category out of several that fired.
function pickMajorityCategory(items: { category: AnomalyCategory; confidence: number }[]): AnomalyCategory {
  const stats = new Map<AnomalyCategory, { count: number; confidenceSum: number }>();
  for (const item of items) {
    const s = stats.get(item.category) ?? { count: 0, confidenceSum: 0 };
    s.count += 1;
    s.confidenceSum += item.confidence;
    stats.set(item.category, s);
  }

  return [...stats.entries()].sort(
    (a, b) =>
      b[1].count - a[1].count ||
      CATEGORY_SPECIFICITY[b[0]] - CATEGORY_SPECIFICITY[a[0]] ||
      b[1].confidenceSum - a[1].confidenceSum,
  )[0]![0];
}

// The LLM voter is the slow/rate-limited/quota-costing one. Its judgment for a given prompt
// doesn't need to be re-derived every 20s if nothing about that prompt has changed — key the
// cache on a hash of the exact prompt text (not a hand-picked signature of the rows) so any
// change that would actually alter what the LLM sees forces a fresh call, and identical inputs
// always hit the cache.
const LLM_CACHE_TTL_MS = 3 * 60 * 1000;
interface LlmCacheEntry {
  result: VoterResult;
  expiresAt: number;
}
const llmCache = new Map<string, LlmCacheEntry>();

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

async function cachedLlmVoter(prompt: string): Promise<VoterResult> {
  const key = hashPrompt(prompt);
  const cached = llmCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const result = await llmVoter(prompt).catch(() => abstain("llm"));
  llmCache.set(key, { result, expiresAt: Date.now() + LLM_CACHE_TTL_MS });
  return result;
}

type TxRow = Awaited<ReturnType<typeof getRecentTransactions>>[number];

function deltaFor(type: TxRow["type"], amount: number): number {
  if (type === "cash_in") return -amount;
  if (type === "cash_out") return amount;
  if (type === "send_money") return -amount;
  return amount;
}

async function velocityVoter(
  agentId: string,
  provider: Provider,
  recentRows: TxRow[],
  referenceTime: Date,
): Promise<VoterResult> {
  const historyRows = await getRecentTransactions(agentId, provider, HISTORY_HOURS, referenceTime);
  const baselineCount = historyRows.length - recentRows.length;
  const baselineHours = HISTORY_HOURS - WINDOW_HOURS;
  const baselineWindows = baselineHours / WINDOW_HOURS;
  const meanPerWindow = baselineWindows > 0 ? baselineCount / baselineWindows : 0;
  const stdev = Math.sqrt(Math.max(meanPerWindow, 0.5));
  const z = (recentRows.length - meanPerWindow) / stdev;
  const fired = z > 2.5 && recentRows.length >= 4;

  return {
    voter: "velocity",
    fired,
    category: "velocity",
    severity: z > 5 ? "high" : "medium",
    confidence: fired ? Math.min(0.92, 0.5 + z * 0.08) : 0.2,
    rationale: fired
      ? `${recentRows.length} transactions in the last ${WINDOW_HOURS}h vs a typical ${meanPerWindow.toFixed(1)} (z=${z.toFixed(1)}).`
      : "Transaction volume is within the normal range for this window.",
    evidence: { currentCount: recentRows.length, meanPerWindow, z },
  };
}

function nearIdenticalVoter(rows: TxRow[]): VoterResult {
  const epsilon = 0.02;
  const buckets: { amount: number; rows: TxRow[] }[] = [];

  for (const row of rows) {
    const amount = Number(row.amount);
    const bucket = buckets.find((b) => Math.abs(b.amount - amount) / Math.max(b.amount, amount) <= epsilon);
    if (bucket) bucket.rows.push(row);
    else buckets.push({ amount, rows: [row] });
  }

  const candidate = buckets.filter((b) => b.rows.length >= 3).sort((a, b) => b.rows.length - a.rows.length)[0];
  if (!candidate) return abstain("near_identical_amounts");

  const distinctParties = new Set(candidate.rows.map((r) => r.partyId)).size;
  const fired = distinctParties <= 3;

  return {
    voter: "near_identical_amounts",
    fired,
    category: "near_identical_amounts",
    severity: candidate.rows.length >= 6 ? "high" : "medium",
    confidence: fired ? Math.min(0.9, 0.5 + candidate.rows.length * 0.05) : 0.2,
    rationale: fired
      ? `${candidate.rows.length} transactions within ~2% of ${Math.round(candidate.amount)} from only ${distinctParties} counterpart${distinctParties === 1 ? "y" : "ies"}.`
      : "No cluster of near-identical amounts from a small counterparty set.",
    evidence: { clusterAmount: candidate.amount, clusterSize: candidate.rows.length, distinctParties },
  };
}

function structuringVoter(rows: TxRow[]): VoterResult {
  const byParty = new Map<string, TxRow[]>();
  for (const row of rows) {
    if (!row.partyId) continue;
    const arr = byParty.get(row.partyId) ?? [];
    arr.push(row);
    byParty.set(row.partyId, arr);
  }

  for (const [partyId, partyRows] of byParty) {
    const smallOnes = partyRows.filter((r) => Number(r.amount) < 5000);
    const total = smallOnes.reduce((sum, r) => sum + Number(r.amount), 0);

    if (smallOnes.length >= 3 && total >= 10_000) {
      return {
        voter: "structuring",
        fired: true,
        category: "structuring",
        severity: smallOnes.length >= 5 ? "high" : "medium",
        confidence: Math.min(0.85, 0.4 + smallOnes.length * 0.08),
        rationale: `${smallOnes.length} sub-5,000 transactions from the same counterparty total ~${Math.round(total)} within the window.`,
        evidence: { partyId, count: smallOnes.length, total },
      };
    }
  }

  return abstain("structuring");
}

function balanceReconciliationVoter(rows: TxRow[]): VoterResult {
  const sorted = [...rows].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  let mismatches = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (cur.status !== "success") continue;

    const expected = Number(prev.providerBalanceAfter) + deltaFor(cur.type, Number(cur.amount));
    if (Math.abs(expected - Number(cur.providerBalanceAfter)) > 1) mismatches++;
  }

  const fired = mismatches > 0;

  return {
    voter: "balance_inconsistency",
    fired,
    category: "balance_inconsistency",
    severity: mismatches > 2 ? "high" : "medium",
    confidence: fired ? Math.min(0.9, 0.5 + mismatches * 0.1) : 0.3,
    rationale: fired
      ? `${mismatches} transaction(s) where the recorded balance doesn't reconcile with the transaction amount.`
      : "Ledger reconciles cleanly for this window.",
    evidence: { mismatches },
  };
}

function buildLlmPrompt(provider: Provider, rows: TxRow[]): string {
  const summary = {
    windowHours: WINDOW_HOURS,
    transactionCount: rows.length,
    distinctCounterparties: new Set(rows.map((r) => r.partyId)).size,
    amounts: rows.map((r) => Number(r.amount)),
    failedCount: rows.filter((r) => r.status === "failed").length,
  };

  return (
    `You are assisting a mobile-money operations analyst. You NEVER declare fraud — only flag ` +
    `patterns as "unusual" or "requires review" with a category and severity, for a human to ` +
    `investigate.\n` +
    `Provider: ${provider}.\n` +
    `Recent ${WINDOW_HOURS}h window summary: ${JSON.stringify(summary)}.\n` +
    `Categories: velocity, near_identical_amounts, structuring, circular, balance_inconsistency, other.\n` +
    `Respond with strict JSON only, no markdown: {"fired": boolean, "category": string, ` +
    `"severity": "low"|"medium"|"high"|"critical", "confidence": number between 0 and 1, ` +
    `"rationale": string under 200 characters}. If nothing seems unusual, set fired to false.`
  );
}

async function llmVoter(prompt: string): Promise<VoterResult> {
  try {
    const { text } = await generateText({ prompt, temperature: 0.2, maxTokens: 300 });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in LLM response");

    const parsed = JSON.parse(match[0]);
    const category = ALLOWED_CATEGORIES.includes(parsed.category) ? parsed.category : "other";
    const severity = ALLOWED_SEVERITIES.includes(parsed.severity) ? parsed.severity : "low";

    return {
      voter: "llm",
      fired: Boolean(parsed.fired),
      category,
      severity,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      rationale: String(parsed.rationale ?? "").slice(0, 300),
    };
  } catch (err) {
    console.error("llmVoter failed:", err);
    return { voter: "llm", fired: false, confidence: 0, rationale: "LLM voter unavailable for this check." };
  }
}

async function analyzeAgentProvider(
  agent: { id: string; blockId: string; name: string },
  provider: Provider,
  referenceTime: Date,
) {
  const recentRows = await getRecentTransactions(agent.id, provider, WINDOW_HOURS, referenceTime);
  if (recentRows.length < 3) return null;

  const cheapVoters = await Promise.all([
    velocityVoter(agent.id, provider, recentRows, referenceTime),
    Promise.resolve(nearIdenticalVoter(recentRows)),
    Promise.resolve(structuringVoter(recentRows)),
    Promise.resolve(balanceReconciliationVoter(recentRows)),
  ]);

  // The ensemble needs >=2/5 voters to fire before an alert is written (see below), and the
  // LLM is only 1 of those 5 — so if none of the 4 cheap voters fired, an LLM "fired" alone
  // could never reach the threshold anyway. Skip the (rate-limited, quota-costing) LLM call
  // entirely in that case rather than burning a request on a result that can't matter.
  const anyCheapFired = cheapVoters.some((v) => v.fired);
  const llmResult = anyCheapFired
    ? await cachedLlmVoter(buildLlmPrompt(provider, recentRows))
    : abstain("llm");

  const voters = [...cheapVoters, llmResult];

  const firing = voters.filter((v) => v.fired);
  if (firing.length < 2) return null;

  const category = pickMajorityCategory(firing.map((v) => ({ category: v.category!, confidence: v.confidence })));

  const severity = firing.reduce<AlertSeverity>(
    (max, v) => (SEVERITY_RANK[v.severity!] > SEVERITY_RANK[max] ? v.severity! : max),
    "low",
  );

  const confidence = (firing.length / voters.length) * (firing.reduce((s, v) => s + v.confidence, 0) / firing.length);

  const llmVote = voters.find((v) => v.voter === "llm");
  const llmReason = llmVote?.fired ? ` Model reasoning: ${llmVote.rationale}` : "";

  // Ground truth for the validation-metrics endpoint: if this window overlaps a deliberately
  // triggered simulation scenario, tag the alert with it — an alert with no scenario tag means
  // it fired purely from ambient random-walk noise (a real false positive, not a demo scenario).
  const scenarioTag = recentRows.find((r) => r.scenarioTag)?.scenarioTag ?? null;

  const description =
    `${firing.length} of ${voters.length} independent checks flagged this pattern as unusual ` +
    `(${category.replace(/_/g, " ")}) on ${provider}. This is not a fraud determination — please ` +
    `review the evidence below before taking any action.${llmReason}`;

  const banglishSummary =
    `${agent.name} (${provider}) te ${category.replace(/_/g, " ")} dhoroner kisu asvabhabik ` +
    `lenden dekha jacche (${firing.length}/${voters.length} check dhoreche, ` +
    `${Math.round(confidence * 100)}% nishchoyota). Eta jaliyati bole dhore neya jabe na — ` +
    `review korar jonno onurodh kora hocche.`;

  return upsertAlert({
    type: "anomaly",
    agentId: agent.id,
    blockId: agent.blockId,
    provider,
    severity,
    title: `Unusual activity requires review — ${agent.name} (${provider})`,
    description,
    banglishSummary,
    evidence: { windowHours: WINDOW_HOURS, transactionCount: recentRows.length },
    confidence,
    category,
    votes: voters,
    scenarioTag,
  });
}

export async function analyzeAnomaly(agentId: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) return [];

  const referenceTime = await getLatestTransactionTime(agentId);
  const results = await Promise.all(
    PROVIDERS.map((provider) => analyzeAgentProvider(agent, provider, referenceTime)),
  );

  return results.filter((r) => r !== null);
}
