import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agentProviderBalances, agents, blocks } from "../../db/schema.js";
import { AppError } from "../../middleware/errorHandler.js";

async function withBalances<T extends { id: string }>(agentRows: T[]) {
  if (agentRows.length === 0) return [];

  const balanceRows = await db
    .select()
    .from(agentProviderBalances)
    .where(inArray(agentProviderBalances.agentId, agentRows.map((a) => a.id)));

  const balancesByAgent = new Map<string, Record<string, string>>();
  for (const row of balanceRows) {
    const current = balancesByAgent.get(row.agentId) ?? {};
    current[row.provider] = row.balance;
    balancesByAgent.set(row.agentId, current);
  }

  return agentRows.map((agent) => ({
    ...agent,
    balances: balancesByAgent.get(agent.id) ?? {},
  }));
}

export async function getAgentSelf(agentId: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) throw new AppError("Agent not found", 404);

  const [withBalance] = await withBalances([agent]);
  return withBalance;
}

export async function listBlockAgents(blockId: string) {
  const agentRows = await db.select().from(agents).where(eq(agents.blockId, blockId));
  return withBalances(agentRows);
}

export async function getBlock(blockId: string) {
  const [block] = await db.select().from(blocks).where(eq(blocks.id, blockId));
  if (!block) throw new AppError("Block not found", 404);
  return block;
}
