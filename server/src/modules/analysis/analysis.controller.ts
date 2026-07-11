import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { alerts } from "../../db/schema.js";
import { AppError } from "../../middleware/errorHandler.js";
import { analyzeLiquidity } from "./liquidity.service.js";
import { analyzeAnomaly } from "./anomaly.service.js";

const recomputeSchema = z.object({
  agentId: z.string().uuid(),
});

export async function recomputeHandler(req: Request, res: Response) {
  const { agentId } = recomputeSchema.parse(req.body);

  const [liquidityAlerts, anomalyAlerts] = await Promise.all([
    analyzeLiquidity(agentId),
    analyzeAnomaly(agentId),
  ]);

  res.status(200).json({ liquidityAlerts, anomalyAlerts });
}

export async function listAlertsHandler(req: Request, res: Response) {
  if (req.userRole === "agent") {
    if (!req.agentId) throw new AppError("Account is not linked to an agent", 403);

    const rows = await db
      .select()
      .from(alerts)
      .where(eq(alerts.agentId, req.agentId))
      .orderBy(desc(alerts.createdAt));

    return res.status(200).json({ alerts: rows });
  }

  if (!req.blockId) throw new AppError("Account is not linked to a block", 403);

  const conditions = [eq(alerts.blockId, req.blockId)];
  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
  if (agentId) conditions.push(eq(alerts.agentId, agentId));

  const rows = await db
    .select()
    .from(alerts)
    .where(and(...conditions))
    .orderBy(desc(alerts.createdAt));

  res.status(200).json({ alerts: rows });
}
