import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agentProviderBalances, agents, daysOfInterest, parties, transactions } from "../../db/schema.js";
import { AppError } from "../../middleware/errorHandler.js";
import {
  SCENARIOS,
  type ActiveScenario,
  type Provider,
  type ScenarioName,
  type SimulationStatus,
  type TransactionType,
} from "./simulation.types.js";

const PROVIDERS: Provider[] = ["bkash", "nagad", "rocket"];
const TICK_INTERVAL_MS = 2000;
const DEFAULT_SPEED_MULTIPLIER = 60;
const DEFAULT_SCENARIO_DURATION_HOURS = 4;

interface AgentState {
  id: string;
  blockId: string;
  cash: number;
  balances: Record<Provider, number>;
  baseRatePerHour: number;
  regularPartyIds: string[];
}

interface DayOfInterestWindow {
  blockId: string | null;
  startDate: Date;
  endDate: Date;
  multiplier: number;
}

let running = false;
let speedMultiplier = DEFAULT_SPEED_MULTIPLIER;
let virtualNow = new Date();
let intervalHandle: NodeJS.Timeout | null = null;
let ticking = false;

const agentStates = new Map<string, AgentState>();
let allPartyIds: string[] = [];
let dayWindows: DayOfInterestWindow[] = [];
const activeScenarios = new Map<string, ActiveScenario>();

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)] as T;
}

async function loadState() {
  const [agentRows, balanceRows, partyRows, dayRows] = await Promise.all([
    db.select().from(agents),
    db.select().from(agentProviderBalances),
    db.select({ id: parties.id }).from(parties),
    db.select().from(daysOfInterest),
  ]);

  allPartyIds = partyRows.map((p) => p.id);

  const balancesByAgent = new Map<string, Record<Provider, number>>();
  for (const row of balanceRows) {
    const current = balancesByAgent.get(row.agentId) ?? { bkash: 0, nagad: 0, rocket: 0 };
    current[row.provider] = Number(row.balance);
    balancesByAgent.set(row.agentId, current);
  }

  agentStates.clear();
  for (const agent of agentRows) {
    const shuffled = [...allPartyIds].sort(() => Math.random() - 0.5);
    agentStates.set(agent.id, {
      id: agent.id,
      blockId: agent.blockId,
      cash: Number(agent.cashBalance),
      balances: balancesByAgent.get(agent.id) ?? { bkash: 0, nagad: 0, rocket: 0 },
      baseRatePerHour: 0.5 + Math.random() * 2.5,
      regularPartyIds: shuffled.slice(0, 10),
    });
  }

  dayWindows = dayRows.map((row) => ({
    blockId: row.blockId,
    startDate: row.startDate,
    endDate: row.endDate,
    multiplier: Number(row.expectedMultiplier),
  }));
}

async function ensureLoaded() {
  if (agentStates.size === 0) {
    virtualNow = new Date();
    await loadState();
  }
}

function activeMultiplierFor(blockId: string): number {
  let multiplier = 1;
  for (const window of dayWindows) {
    if (virtualNow >= window.startDate && virtualNow <= window.endDate) {
      if (window.blockId === null || window.blockId === blockId) {
        multiplier = Math.max(multiplier, window.multiplier);
      }
    }
  }
  return multiplier;
}

function pruneExpiredScenarios() {
  for (const [agentId, scenario] of activeScenarios.entries()) {
    if (new Date(scenario.expiresAtVirtual) <= virtualNow) {
      activeScenarios.delete(agentId);
    }
  }
}

function draftOne(
  agent: AgentState,
  scenario: ActiveScenario | undefined,
): typeof transactions.$inferInsert | null {
  const provider: Provider = scenario ? scenario.provider : pick(PROVIDERS);

  if (scenario?.scenario === "provider_feed_gap" && provider === scenario.provider) {
    return null;
  }

  let type: TransactionType = pick(["cash_in", "cash_out", "send_money", "payment"] as const);
  let partyId: string;
  let amount: number;

  if (scenario?.scenario === "hidden_provider_shortage") {
    type = Math.random() < 0.8 ? "cash_in" : "send_money";
    partyId = Math.random() < 0.5 ? pick(agent.regularPartyIds) : pick(allPartyIds);
    amount = randInt(8000, 25000);
  } else if (scenario?.scenario === "cash_and_anomaly_spike") {
    if (Math.random() < 0.6) {
      type = "cash_out";
      partyId = pick(allPartyIds);
      amount = randInt(5000, 20000);
    } else {
      type = pick(["cash_in", "send_money"] as const);
      partyId = pick(agent.regularPartyIds.slice(0, 3));
      amount = 5000 + randInt(-50, 50);
    }
  } else if (scenario?.scenario === "near_identical_amounts") {
    type = pick(["cash_in", "cash_out"] as const);
    partyId = pick(agent.regularPartyIds.slice(0, 3));
    amount = 10000 + randInt(-25, 25);
  } else {
    partyId = Math.random() < 0.7 ? pick(agent.regularPartyIds) : pick(allPartyIds);
    amount = randInt(200, 15000);
  }

  const decreasesCash = type === "cash_out";
  const decreasesProvider = type === "cash_in" || type === "send_money";
  const insufficientFunds =
    (decreasesCash && amount > agent.cash) || (decreasesProvider && amount > agent.balances[provider]);
  const status = insufficientFunds || Math.random() < 0.03 ? "failed" : "success";

  if (status === "success") {
    if (type === "cash_in") {
      agent.cash += amount;
      agent.balances[provider] -= amount;
    } else if (type === "cash_out") {
      agent.cash -= amount;
      agent.balances[provider] += amount;
    } else if (type === "send_money") {
      agent.balances[provider] -= amount;
    } else {
      agent.balances[provider] += amount;
    }
  }

  return {
    agentId: agent.id,
    provider,
    partyId,
    type,
    amount: amount.toFixed(2),
    status,
    cashBalanceAfter: agent.cash.toFixed(2),
    providerBalanceAfter: agent.balances[provider].toFixed(2),
    occurredAt: new Date(virtualNow),
    scenarioTag: scenario ? scenario.scenario : null,
  };
}

function draftTransactionsForAgent(agent: AgentState, elapsedHours: number) {
  const scenario = activeScenarios.get(agent.id);
  const dayMultiplier = activeMultiplierFor(agent.blockId);
  const scenarioMultiplier = scenario ? 4 : 1;
  const expectedCount = agent.baseRatePerHour * elapsedHours * dayMultiplier * scenarioMultiplier;

  let count = Math.floor(expectedCount);
  if (Math.random() < expectedCount - count) count += 1;

  const rows: (typeof transactions.$inferInsert)[] = [];
  for (let i = 0; i < count; i++) {
    const row = draftOne(agent, scenario);
    if (row) rows.push(row);
  }

  return rows;
}

async function tick() {
  if (ticking) return;
  ticking = true;

  try {
    const elapsedMs = TICK_INTERVAL_MS * speedMultiplier;
    virtualNow = new Date(virtualNow.getTime() + elapsedMs);
    const elapsedHours = elapsedMs / (60 * 60 * 1000);

    pruneExpiredScenarios();

    const allRows: (typeof transactions.$inferInsert)[] = [];
    const touchedAgents: AgentState[] = [];

    for (const agent of agentStates.values()) {
      const rows = draftTransactionsForAgent(agent, elapsedHours);
      if (rows.length > 0) {
        allRows.push(...rows);
        touchedAgents.push(agent);
      }
    }

    if (allRows.length === 0) return;

    await db.insert(transactions).values(allRows);

    await Promise.all(
      touchedAgents.map(async (agent) => {
        await db.update(agents).set({ cashBalance: agent.cash.toFixed(2) }).where(eq(agents.id, agent.id));

        await Promise.all(
          PROVIDERS.map((provider) =>
            db
              .update(agentProviderBalances)
              .set({ balance: agent.balances[provider].toFixed(2) })
              .where(
                and(
                  eq(agentProviderBalances.agentId, agent.id),
                  eq(agentProviderBalances.provider, provider),
                ),
              ),
          ),
        );
      }),
    );
  } finally {
    ticking = false;
  }
}

export async function startSimulation(speed?: number) {
  if (speed) speedMultiplier = speed;
  await ensureLoaded();

  if (!running) {
    running = true;
    intervalHandle = setInterval(() => {
      void tick();
    }, TICK_INTERVAL_MS);
  }

  return getStatus();
}

export function stopSimulation() {
  running = false;
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  return getStatus();
}

export function setSpeed(multiplier: number) {
  if (multiplier <= 0) {
    throw new AppError("speedMultiplier must be positive", 400);
  }
  speedMultiplier = multiplier;
  return getStatus();
}

export function getStatus(): SimulationStatus {
  return {
    running,
    speedMultiplier,
    virtualNow: virtualNow.toISOString(),
    activeScenarios: Array.from(activeScenarios.values()),
  };
}

export function listScenarios() {
  return SCENARIOS;
}

export async function triggerScenario(params: {
  agentId: string;
  scenario: ScenarioName;
  provider: Provider;
  durationHours?: number;
}) {
  await ensureLoaded();

  if (!agentStates.has(params.agentId)) {
    throw new AppError("Unknown agent", 404);
  }

  const duration = params.durationHours ?? DEFAULT_SCENARIO_DURATION_HOURS;
  const expiresAtVirtual = new Date(virtualNow.getTime() + duration * 60 * 60 * 1000);

  activeScenarios.set(params.agentId, {
    scenario: params.scenario,
    agentId: params.agentId,
    provider: params.provider,
    startedAtVirtual: virtualNow.toISOString(),
    expiresAtVirtual: expiresAtVirtual.toISOString(),
  });

  return getStatus();
}
