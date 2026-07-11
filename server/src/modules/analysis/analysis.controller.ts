import type { Request, Response } from "express";
import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { alerts, type AlertType, type AnomalyCategory } from "../../db/schema.js";
import { AppError } from "../../middleware/errorHandler.js";
import { analyzeLiquidity } from "./liquidity.service.js";
import { analyzeAnomaly } from "./anomaly.service.js";
import { agentAcknowledgeAlert, agentRequestSupport, applyAlertAction } from "./analysis.shared.js";
import { resolveEffectiveBlockId } from "../daysOfInterest/daysOfInterest.service.js";

const recomputeSchema = z.object({
  agentId: z.string().uuid(),
});

const alertActionSchema = z.object({
  action: z.enum(["acknowledge", "escalate", "resolve"]),
  note: z.string().max(2000).optional(),
});

const requestSupportSchema = z.object({
  note: z.string().min(1).max(500),
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

    // Agents see their own alerts, plus block-level trend forecasts (agentId null) for their
    // own block — those are written with no agentId since they aren't about any single agent.
    // "open" alerts are excluded: that status means ops hasn't acted on it yet ("Alert agent"
    // moves it to "acknowledged"), so agents shouldn't see an alert before ops has actually
    // decided to notify them about it.
    const blockId = await resolveEffectiveBlockId({ role: "agent", agentId: req.agentId });

    const rows = await db
      .select()
      .from(alerts)
      .where(
        and(
          ne(alerts.status, "open"),
          isNull(alerts.agentAcknowledgedAt),
          or(
            eq(alerts.agentId, req.agentId),
            blockId ? and(isNull(alerts.agentId), eq(alerts.blockId, blockId)) : undefined,
          ),
        ),
      )
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

interface MetricsBucket {
  total: number;
  scenarioDriven: number;
  background: number;
  falsePositiveRate: number | null;
}

function emptyBucket(): MetricsBucket {
  return { total: 0, scenarioDriven: 0, background: 0, falsePositiveRate: null };
}

function tally(bucket: MetricsBucket, scenarioTag: string | null) {
  bucket.total += 1;
  if (scenarioTag) bucket.scenarioDriven += 1;
  else bucket.background += 1;
  bucket.falsePositiveRate = bucket.total === 0 ? null : bucket.background / bucket.total;
}

// Deliberately public (no requireAuth) — same rationale as /api/simulation: this is
// judge/evaluation-facing evidence about detection quality across the whole (synthetic) demo
// dataset, not a per-block operational view, so it doesn't fit the role-scoped routes below.
// "Background" (no scenarioTag) alerts are a real false-positive-rate proxy: they fired from
// pure random-walk simulation noise, not from any deliberately injected scenario.
export async function metricsHandler(_req: Request, res: Response) {
  const rows = await db
    .select({ type: alerts.type, category: alerts.category, scenarioTag: alerts.scenarioTag })
    .from(alerts);

  const overall = emptyBucket();
  const byType: Record<AlertType, MetricsBucket> = {
    liquidity: emptyBucket(),
    anomaly: emptyBucket(),
    trend: emptyBucket(),
  };
  const byCategory: Partial<Record<AnomalyCategory, MetricsBucket>> = {};

  for (const row of rows) {
    tally(overall, row.scenarioTag);
    tally(byType[row.type], row.scenarioTag);

    if (row.category) {
      byCategory[row.category] ??= emptyBucket();
      tally(byCategory[row.category]!, row.scenarioTag);
    }
  }

  res.status(200).json({ overall, byType, byCategory });
}

export async function alertActionHandler(req: Request, res: Response) {
  if (!req.blockId || !req.userId) throw new AppError("Account is not linked to a block", 403);

  const { action, note } = alertActionSchema.parse(req.body);
  const alertId = z.string().uuid().parse(req.params.id);

  const updated = await applyAlertAction({
    alertId,
    blockId: req.blockId,
    action,
    actorUserId: req.userId,
    note,
  });

  res.status(200).json({ alert: updated });
}

export async function agentAckHandler(req: Request, res: Response) {
  if (!req.agentId || !req.userId) throw new AppError("Account is not linked to an agent", 403);

  const alertId = z.string().uuid().parse(req.params.id);

  const updated = await agentAcknowledgeAlert({
    alertId,
    agentId: req.agentId,
    actorUserId: req.userId,
  });

  res.status(200).json({ alert: updated });
}

export async function agentRequestSupportHandler(req: Request, res: Response) {
  if (!req.agentId || !req.userId) throw new AppError("Account is not linked to an agent", 403);

  const alertId = z.string().uuid().parse(req.params.id);
  const { note } = requestSupportSchema.parse(req.body);

  const alert = await agentRequestSupport({
    alertId,
    agentId: req.agentId,
    actorUserId: req.userId,
    note,
  });

  res.status(200).json({ alert });
}
