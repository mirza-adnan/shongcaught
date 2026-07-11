import { sql } from "drizzle-orm";
import { db } from "./index.js";
import {
  agentProviderBalances,
  agents,
  blocks,
  daysOfInterest,
  parties,
  providerEnum,
  transactions,
  users,
} from "./schema.js";
import { hashPassword } from "../utils/password.js";

const AGENT_DEMO_PASSWORD = "AgentDemo#123";
const OPS_DEMO_PASSWORD = "OpsDemo#123";
const TOTAL_AGENTS = 100;
// 14 days (exactly 2 full weeks) so every weekday has at least 2 occurrences in history — the
// minimum the block-level day-of-week trend forecast (trend.service.ts) needs to say anything
// at all. 5 days (the old value) meant no weekday could ever recur, so the feature could never
// fire against seed data.
const HISTORY_DAYS = 14;
const PROVIDERS = providerEnum.enumValues;

const BLOCK_DEFS = [
  { name: "Uttara", centerLat: 23.8759, centerLng: 90.3795 },
  { name: "Mirpur", centerLat: 23.8223, centerLng: 90.3654 },
  { name: "Dhanmondi", centerLat: 23.7461, centerLng: 90.3742 },
  { name: "Gulshan", centerLat: 23.7925, centerLng: 90.4078 },
  { name: "Mohammadpur", centerLat: 23.7656, centerLng: 90.3588 },
  { name: "Motijheel", centerLat: 23.7332, centerLng: 90.4172 },
  { name: "Jatrabari", centerLat: 23.7104, centerLng: 90.4331 },
  { name: "Old Dhaka", centerLat: 23.7185, centerLng: 90.3897 },
];

const FIRST_NAMES = [
  "Rahim", "Karim", "Jamal", "Kamal", "Nasrin", "Shirin", "Habib", "Rafiq", "Sultana", "Momtaz",
  "Faruk", "Anwar", "Selina", "Rina", "Delwar", "Shahin", "Nazrul", "Rubel", "Hasan", "Hosne",
  "Mizanur", "Aminul", "Shamsun", "Rokeya", "Iqbal", "Zahid", "Parvin", "Lutfor", "Salma", "Monir",
];
const LAST_NAMES = [
  "Islam", "Ahmed", "Hossain", "Rahman", "Khan", "Uddin", "Akter", "Chowdhury", "Miah", "Begum",
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)] as T;
}

function randomName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function jitterCoord(center: number, spread: number): number {
  return center + (Math.random() - 0.5) * spread;
}

function makePhoneFactory() {
  const used = new Set<string>();
  return () => {
    let phone: string;
    do {
      phone = `01${randInt(3, 9)}${String(randInt(0, 99999999)).padStart(8, "0")}`;
    } while (used.has(phone));
    used.add(phone);
    return phone;
  };
}

async function truncateAll() {
  await db.execute(sql`
    TRUNCATE TABLE
      case_events, alerts, transactions, agent_provider_balances,
      days_of_interest, parties, users, agents, blocks
    RESTART IDENTITY CASCADE
  `);
}

async function seedBlocks() {
  return db.insert(blocks).values(BLOCK_DEFS).returning();
}

async function seedOpsUsers(seededBlocks: Awaited<ReturnType<typeof seedBlocks>>) {
  const opsPasswordHash = await hashPassword(OPS_DEMO_PASSWORD);
  const slug = (name: string) => name.toLowerCase().replace(/\s+/g, "");

  await db.insert(users).values(
    seededBlocks.map((block) => ({
      email: `ops.${slug(block.name)}@demo.local`,
      name: `${block.name} Ops Team`,
      passwordHash: opsPasswordHash,
      role: "ops" as const,
      blockId: block.id,
    })),
  );
}

async function seedParties(nextPhone: () => string, count: number) {
  return db
    .insert(parties)
    .values(Array.from({ length: count }, () => ({ phone: nextPhone(), name: randomName() })))
    .returning();
}

// Bangladesh's weekend is Friday-Saturday. Real mobile-money agents plausibly see a pre-weekend
// cash-out rush on Thursday and a quieter weekend — a small, documented bias so the block-level
// day-of-week trend forecast (trend.service.ts) has a genuine recurring pattern to find, rather
// than pure uniform-random noise (which has no real day-of-week signal by construction).
const WEEKDAY_VOLUME_MULTIPLIER: Record<number, number> = {
  0: 1.0, // Sunday
  1: 1.0, // Monday
  2: 1.0, // Tuesday
  3: 1.0, // Wednesday
  4: 1.5, // Thursday — pre-weekend rush
  5: 0.6, // Friday — weekend
  6: 0.8, // Saturday — weekend
};

function generateAgentHistory(params: {
  agentId: string;
  openingCash: number;
  openingProviderBalances: Record<(typeof PROVIDERS)[number], number>;
  regulars: { id: string }[];
  allParties: { id: string }[];
}) {
  const { agentId, regulars, allParties } = params;
  let cash = params.openingCash;
  const providerBalances = { ...params.openingProviderBalances };

  const rows: (typeof transactions.$inferInsert)[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  // Anchor day buckets to UTC midnight, not to "now"'s arbitrary time-of-day — a bucket like
  // [now, now+24h) straddles two calendar dates, so a uniformly random offset within it mostly
  // lands on the *next* calendar day whenever "now" is past noon, silently shifting the
  // intended weekday bias (below) by a day.
  const todayMidnightUtc = Math.floor(now / dayMs) * dayMs;
  const startMs = todayMidnightUtc - HISTORY_DAYS * dayMs;
  const txCount = randInt(80, 130);

  const dayWeights = Array.from({ length: HISTORY_DAYS }, (_, d) => {
    const weekday = new Date(startMs + d * dayMs).getUTCDay();
    return WEEKDAY_VOLUME_MULTIPLIER[weekday] ?? 1;
  });
  const totalWeight = dayWeights.reduce((sum, w) => sum + w, 0);

  function pickWeightedDayOffset(): number {
    let r = Math.random() * totalWeight;
    for (let d = 0; d < dayWeights.length; d++) {
      r -= dayWeights[d]!;
      if (r <= 0) return d;
    }
    return dayWeights.length - 1;
  }

  const timestamps = Array.from({ length: txCount }, () => {
    const dayOffset = pickWeightedDayOffset();
    return startMs + dayOffset * dayMs + Math.random() * dayMs;
  }).sort((a, b) => a - b);

  for (const ts of timestamps) {
    const provider = pick(PROVIDERS);
    const type = pick(["cash_in", "cash_out", "send_money", "payment"] as const);
    const party = Math.random() < 0.7 ? pick(regulars) : pick(allParties);
    const amount = randInt(200, 15000);

    const decreasesCash = type === "cash_out";
    const decreasesProvider = type === "cash_in" || type === "send_money";
    const insufficientFunds =
      (decreasesCash && amount > cash) || (decreasesProvider && amount > providerBalances[provider]);
    const status = insufficientFunds || Math.random() < 0.03 ? "failed" : "success";

    if (status === "success") {
      if (type === "cash_in") {
        cash += amount;
        providerBalances[provider] -= amount;
      } else if (type === "cash_out") {
        cash -= amount;
        providerBalances[provider] += amount;
      } else if (type === "send_money") {
        providerBalances[provider] -= amount;
      } else {
        providerBalances[provider] += amount;
      }
    }

    rows.push({
      agentId,
      provider,
      partyId: party.id,
      type,
      amount: amount.toFixed(2),
      status,
      cashBalanceAfter: cash.toFixed(2),
      providerBalanceAfter: providerBalances[provider].toFixed(2),
      occurredAt: new Date(ts),
    });
  }

  return { rows, finalCash: cash, finalProviderBalances: providerBalances };
}

async function seedAgentsAndTransactions(
  seededBlocks: Awaited<ReturnType<typeof seedBlocks>>,
  seededParties: Awaited<ReturnType<typeof seedParties>>,
  nextPhone: () => string,
) {
  const agentPasswordHash = await hashPassword(AGENT_DEMO_PASSWORD);

  for (let i = 0; i < TOTAL_AGENTS; i++) {
    const block = seededBlocks[i % seededBlocks.length]!;
    const openingCash = randInt(15_000, 80_000);
    const openingProviderBalances = {
      bkash: randInt(20_000, 150_000),
      nagad: randInt(20_000, 150_000),
      rocket: randInt(20_000, 150_000),
    };

    const [agent] = await db
      .insert(agents)
      .values({
        name: `${randomName()} Agent Point`,
        phone: nextPhone(),
        blockId: block.id,
        lat: jitterCoord(block.centerLat, 0.03),
        lng: jitterCoord(block.centerLng, 0.03),
        cashBalance: openingCash.toFixed(2),
      })
      .returning();

    if (!agent) throw new Error("Failed to insert agent");

    const agentIndex = String(i + 1).padStart(4, "0");
    await db.insert(users).values({
      email: `agent${agentIndex}@demo.local`,
      name: agent.name,
      passwordHash: agentPasswordHash,
      role: "agent",
      agentId: agent.id,
    });

    const regularsPoolStart = randInt(0, seededParties.length - 20);
    const regulars = seededParties.slice(regularsPoolStart, regularsPoolStart + 15);

    const { rows, finalCash, finalProviderBalances } = generateAgentHistory({
      agentId: agent.id,
      openingCash,
      openingProviderBalances,
      regulars,
      allParties: seededParties,
    });

    if (rows.length > 0) {
      await db.insert(transactions).values(rows);
    }

    await db.update(agents).set({ cashBalance: finalCash.toFixed(2) }).where(sql`${agents.id} = ${agent.id}`);
    await db.insert(agentProviderBalances).values(
      PROVIDERS.map((provider) => ({
        agentId: agent.id,
        provider,
        balance: finalProviderBalances[provider].toFixed(2),
      })),
    );

    if ((i + 1) % 10 === 0) {
      console.log(`  seeded ${i + 1}/${TOTAL_AGENTS} agents`);
    }
  }
}

async function seedDaysOfInterest(seededBlocks: Awaited<ReturnType<typeof seedBlocks>>) {
  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  await db.insert(daysOfInterest).values([
    {
      scope: "global",
      name: "Eid-ul-Fitr",
      startDate: inDays(2),
      endDate: inDays(4),
      expectedMultiplier: "2.50",
      note: "Countrywide surge in cash-out demand expected before Eid.",
    },
    {
      scope: "global",
      name: "Eid-ul-Adha",
      startDate: inDays(9),
      endDate: inDays(11),
      expectedMultiplier: "2.80",
      note: "Cattle-market cash withdrawals typically spike nationwide in the days before.",
    },
    {
      scope: "global",
      name: "Pohela Boishakh (Bengali New Year)",
      startDate: inDays(20),
      endDate: inDays(20),
      expectedMultiplier: "1.90",
      note: "Retail and gift spending surge nationwide.",
    },
    {
      scope: "global",
      name: "Ramadan begins",
      startDate: inDays(30),
      endDate: inDays(32),
      expectedMultiplier: "1.60",
      note: "Grocery and iftar-related cash-out demand rises in the evenings through the month.",
    },
    {
      scope: "global",
      name: "Month-end salary window",
      startDate: inDays(5),
      endDate: inDays(7),
      expectedMultiplier: "1.70",
      note: "Salary disbursement days drive a recurring nationwide cash-out spike near month-end.",
    },
    {
      scope: "global",
      name: "Independence Day",
      startDate: inDays(14),
      endDate: inDays(14),
      expectedMultiplier: "1.40",
      note: "Public holiday with moderate retail and travel-related cash demand.",
    },
    {
      scope: "global",
      name: "Victory Day",
      startDate: inDays(45),
      endDate: inDays(45),
      expectedMultiplier: "1.40",
      note: "Public holiday with moderate retail and travel-related cash demand.",
    },
    {
      scope: "global",
      name: "Durga Puja",
      startDate: inDays(25),
      endDate: inDays(27),
      expectedMultiplier: "1.75",
      note: "Regional festival with elevated retail and travel cash-out demand.",
    },
    {
      scope: "block",
      blockId: seededBlocks[0]!.id,
      name: "Uttara Sector Fest",
      startDate: inDays(1),
      endDate: inDays(1),
      expectedMultiplier: "1.80",
      note: "Local festival expected to raise transaction volume in this block only.",
    },
  ]);
}

async function main() {
  console.log("Truncating existing data...");
  await truncateAll();

  console.log("Seeding blocks...");
  const seededBlocks = await seedBlocks();

  console.log("Seeding ops users...");
  await seedOpsUsers(seededBlocks);

  const nextPhone = makePhoneFactory();

  console.log("Seeding synthetic parties...");
  const seededParties = await seedParties(nextPhone, 300);

  console.log(`Seeding ${TOTAL_AGENTS} agents with transaction history (this can take a minute)...`);
  await seedAgentsAndTransactions(seededBlocks, seededParties, nextPhone);

  console.log("Seeding days of interest...");
  await seedDaysOfInterest(seededBlocks);

  console.log("\nDone.");
  console.log(`Demo agent login: agent0001@demo.local / ${AGENT_DEMO_PASSWORD}`);
  console.log(`Demo ops login:   ops.uttara@demo.local / ${OPS_DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
