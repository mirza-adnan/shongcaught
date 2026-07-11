import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, blocks, transactions } from "../../db/schema.js";
import { upsertAlert } from "./analysis.shared.js";

const WINDOW_DAYS = 21;
// A full week so the next occurrence of any busy weekday is always in range, regardless of
// what day "today" happens to be (a 3-day window, for instance, would miss a Thursday spike
// entirely if today is a Saturday).
const LOOKAHEAD_DAYS = 7;
const MIN_OCCURRENCES = 2;
const ELEVATED_RATIO = 1.3;

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface WeekdayStats {
  occurrences: number;
  total: number;
}

interface BestCandidate {
  weekday: number;
  daysAhead: number;
  occurrences: number;
  avgOnDay: number;
  ratio: number;
}

function pickBestCandidate(
  perWeekday: Map<number, WeekdayStats>,
  overallAvgPerDay: number,
  referenceTime: Date,
): BestCandidate | null {
  let best: BestCandidate | null = null;

  for (let daysAhead = 0; daysAhead < LOOKAHEAD_DAYS; daysAhead++) {
    const candidateDate = new Date(referenceTime.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const weekday = candidateDate.getUTCDay();
    const stats = perWeekday.get(weekday);
    if (!stats || stats.occurrences < MIN_OCCURRENCES) continue;

    const avgOnDay = stats.total / stats.occurrences;
    const ratio = avgOnDay / overallAvgPerDay;
    if (ratio <= ELEVATED_RATIO) continue;

    if (!best || ratio > best.ratio) {
      best = { weekday, daysAhead, occurrences: stats.occurrences, avgOnDay, ratio };
    }
  }

  return best;
}

/**
 * Block-level day-of-week demand forecast: pools every agent's transactions in the block (a
 * single agent's history is too sparse to trust a recurring pattern, but ~10-15 agents sharing
 * the same weekday gives a real sample) and checks whether any of the next few days is a
 * weekday that has historically run significantly busier than average. This can only detect
 * day-of-week seasonality, not day-of-month/monthly seasonality — that would need months of
 * elapsed calendar time regardless of how many agents are pooled, which the seed data doesn't
 * have. Always low severity: this is a heads-up for planning, not an urgent liquidity/anomaly
 * finding.
 */
export async function analyzeTrend(blockId: string) {
  const [block] = await db.select().from(blocks).where(eq(blocks.id, blockId));
  if (!block) return null;

  const agentRows = await db.select({ id: agents.id }).from(agents).where(eq(agents.blockId, blockId));
  const agentIds = agentRows.map((r) => r.id);
  if (agentIds.length === 0) return null;

  const [latest] = await db
    .select({ occurredAt: transactions.occurredAt })
    .from(transactions)
    .where(inArray(transactions.agentId, agentIds))
    .orderBy(desc(transactions.occurredAt))
    .limit(1);
  const referenceTime = latest?.occurredAt ?? new Date();

  const since = new Date(referenceTime.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ occurredAt: transactions.occurredAt })
    .from(transactions)
    .where(and(inArray(transactions.agentId, agentIds), gte(transactions.occurredAt, since)));

  const perDateCount = new Map<string, number>();
  for (const row of rows) {
    const dateKey = row.occurredAt.toISOString().slice(0, 10);
    perDateCount.set(dateKey, (perDateCount.get(dateKey) ?? 0) + 1);
  }
  if (perDateCount.size === 0) return null;

  const perWeekday = new Map<number, WeekdayStats>();
  for (const [dateKey, count] of perDateCount) {
    const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
    const stats = perWeekday.get(weekday) ?? { occurrences: 0, total: 0 };
    stats.occurrences += 1;
    stats.total += count;
    perWeekday.set(weekday, stats);
  }

  const overallAvgPerDay = rows.length / perDateCount.size;
  const best = pickBestCandidate(perWeekday, overallAvgPerDay, referenceTime);
  if (!best) return null;

  const weekdayName = WEEKDAY_NAMES[best.weekday];
  const pctBusier = Math.round((best.ratio - 1) * 100);
  const timing = best.daysAhead === 0 ? "today" : best.daysAhead === 1 ? "tomorrow" : `in ${best.daysAhead} days`;
  const confidence = Math.min(0.8, 0.25 + best.occurrences * 0.12 + Math.min(best.ratio - 1, 1) * 0.25);

  const description =
    `Based on the last ${WINDOW_DAYS} days of activity across this block, ${weekdayName}s see roughly ` +
    `${pctBusier}% more transactions than an average day (observed over ${best.occurrences} ${weekdayName}s). ` +
    `The next ${weekdayName} is ${timing} — consider having extra cash/float on hand. This is a pattern ` +
    `observed in recent history, not a certainty, and gets more reliable with more weeks of data.`;

  const banglishSummary =
    `${block.name} e ${weekdayName} din gulote gore ${pctBusier}% beshi lenden hoy ` +
    `(${best.occurrences}ta ${weekdayName} theke dekha geche). Porer ${weekdayName} ${timing} — extra ` +
    `cash/float rakhar jonno probable. Eta ekta purbanuman, guaranteed na.`;

  return upsertAlert({
    type: "trend",
    agentId: null,
    blockId,
    provider: null,
    severity: "low",
    title: `Elevated demand expected — ${block.name} (${weekdayName})`,
    description,
    banglishSummary,
    evidence: {
      windowDays: WINDOW_DAYS,
      weekday: weekdayName,
      occurrences: best.occurrences,
      avgOnDay: best.avgOnDay,
      overallAvgPerDay,
      ratio: best.ratio,
      daysAhead: best.daysAhead,
    },
    confidence,
  });
}
