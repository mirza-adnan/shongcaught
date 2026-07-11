import { eq, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agents, daysOfInterest } from "../../db/schema.js";

export async function resolveEffectiveBlockId(params: {
  role: "agent" | "ops";
  agentId?: string | null;
  blockId?: string | null;
}): Promise<string | null> {
  if (params.role === "ops") return params.blockId ?? null;

  if (params.role === "agent" && params.agentId) {
    const [agent] = await db
      .select({ blockId: agents.blockId })
      .from(agents)
      .where(eq(agents.id, params.agentId));
    return agent?.blockId ?? null;
  }

  return null;
}

export async function listDaysOfInterest(blockId: string | null) {
  if (!blockId) {
    return db.select().from(daysOfInterest).where(eq(daysOfInterest.scope, "global"));
  }

  return db
    .select()
    .from(daysOfInterest)
    .where(or(eq(daysOfInterest.scope, "global"), eq(daysOfInterest.blockId, blockId)));
}

export async function createBlockDayOfInterest(input: {
  blockId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  expectedMultiplier: number;
  note?: string;
}) {
  const [created] = await db
    .insert(daysOfInterest)
    .values({
      scope: "block",
      blockId: input.blockId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      expectedMultiplier: input.expectedMultiplier.toFixed(2),
      note: input.note,
    })
    .returning();

  return created!;
}
