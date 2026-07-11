import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agentProviderBalances, agents, type AlertSeverity, type Provider } from "../../db/schema.js";
import { getLatestTransactionTime, getRecentTransactions, upsertAlert } from "./analysis.shared.js";

const WINDOW_HOURS = 6;
const SHORTAGE_HORIZON_HOURS = 6;
const PROVIDERS: Provider[] = ["bkash", "nagad", "rocket"];

interface BurnAnalysis {
  currentBalance: number;
  burnPerHour: number;
  sampleCount: number;
  maxGapHours: number;
}

function analyzeBurn(
  rows: { occurredAt: Date; balanceAfter: number }[],
  referenceTime: Date,
  currentBalance: number,
): BurnAnalysis {
  if (rows.length === 0) {
    return { currentBalance, burnPerHour: 0, sampleCount: 0, maxGapHours: WINDOW_HOURS };
  }

  const sorted = [...rows].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const oldest = sorted[0]!;
  const elapsedHours = Math.max((referenceTime.getTime() - oldest.occurredAt.getTime()) / 3_600_000, 0.25);
  const burnPerHour = (currentBalance - oldest.balanceAfter) / elapsedHours;

  let maxGapMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    maxGapMs = Math.max(maxGapMs, sorted[i]!.occurredAt.getTime() - sorted[i - 1]!.occurredAt.getTime());
  }

  return { currentBalance, burnPerHour, sampleCount: sorted.length, maxGapHours: maxGapMs / 3_600_000 };
}

function confidenceFor(burn: BurnAnalysis): number {
  let confidence = 0.95;
  if (burn.sampleCount < 5) confidence *= 0.4 + 0.12 * burn.sampleCount;
  if (burn.maxGapHours > WINDOW_HOURS / 2) confidence *= 0.5;
  return Math.max(0.05, Math.min(confidence, 0.97));
}

function severityFor(hoursToZero: number): AlertSeverity {
  if (hoursToZero <= 1) return "critical";
  if (hoursToZero <= 3) return "high";
  return "medium";
}

async function evaluate(
  agent: { id: string; blockId: string; name: string },
  provider: Provider | null,
  burn: BurnAnalysis,
  referenceTime: Date,
) {
  if (burn.burnPerHour >= 0 || burn.currentBalance <= 0) return null;

  const hoursToZero = burn.currentBalance / Math.abs(burn.burnPerHour);
  if (hoursToZero > SHORTAGE_HORIZON_HOURS) return null;

  const confidence = confidenceFor(burn);
  const predictedShortageAt = new Date(referenceTime.getTime() + hoursToZero * 3_600_000);
  const label = provider ? provider.toUpperCase() : "Physical cash";

  const description =
    `Based on the last ~${WINDOW_HOURS}h of activity (${burn.sampleCount} transactions), ` +
    `${label} at ${agent.name} is depleting at roughly ${Math.abs(burn.burnPerHour).toFixed(0)}/hr ` +
    `and may run out in about ${hoursToZero.toFixed(1)} hours. This is a projection based on recent ` +
    `activity, not a certainty — confirm with the agent before acting.` +
    (burn.sampleCount < 5 || burn.maxGapHours > WINDOW_HOURS / 2
      ? " Confidence is reduced because recent transaction data is sparse or has gaps."
      : "");

  return upsertAlert({
    type: "liquidity",
    agentId: agent.id,
    blockId: agent.blockId,
    provider,
    severity: severityFor(hoursToZero),
    title: `${label} shortage projected — ${agent.name}`,
    description,
    evidence: {
      windowHours: WINDOW_HOURS,
      sampleCount: burn.sampleCount,
      burnPerHour: burn.burnPerHour,
      currentBalance: burn.currentBalance,
      maxGapHours: burn.maxGapHours,
      hoursToZero,
    },
    confidence,
    predictedShortageAt,
  });
}

export async function analyzeLiquidity(agentId: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) return [];

  const referenceTime = await getLatestTransactionTime(agentId);
  const balances = await db
    .select()
    .from(agentProviderBalances)
    .where(eq(agentProviderBalances.agentId, agentId));

  const results = [];

  const cashRows = await getRecentTransactions(agentId, undefined, WINDOW_HOURS, referenceTime);
  const cashBurn = analyzeBurn(
    cashRows.map((r) => ({ occurredAt: r.occurredAt, balanceAfter: Number(r.cashBalanceAfter) })),
    referenceTime,
    Number(agent.cashBalance),
  );
  results.push(await evaluate(agent, null, cashBurn, referenceTime));

  for (const provider of PROVIDERS) {
    const balanceRow = balances.find((b) => b.provider === provider);
    if (!balanceRow) continue;

    const providerRows = await getRecentTransactions(agentId, provider, WINDOW_HOURS, referenceTime);
    const burn = analyzeBurn(
      providerRows.map((r) => ({ occurredAt: r.occurredAt, balanceAfter: Number(r.providerBalanceAfter) })),
      referenceTime,
      Number(balanceRow.balance),
    );
    results.push(await evaluate(agent, provider, burn, referenceTime));
  }

  return results.filter((r) => r !== null);
}
