import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../middleware/errorHandler.js";
import * as daysOfInterestService from "./daysOfInterest.service.js";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  expectedMultiplier: z.number().positive().max(20),
  note: z.string().max(2000).optional(),
});

export async function listHandler(req: Request, res: Response) {
  const blockId = await daysOfInterestService.resolveEffectiveBlockId({
    role: req.userRole as "agent" | "ops",
    agentId: req.agentId,
    blockId: req.blockId,
  });

  const rows = await daysOfInterestService.listDaysOfInterest(blockId);
  res.status(200).json({ daysOfInterest: rows });
}

export async function createHandler(req: Request, res: Response) {
  if (!req.blockId) throw new AppError("Account is not linked to a block", 403);

  const body = createSchema.parse(req.body);
  const created = await daysOfInterestService.createBlockDayOfInterest({
    blockId: req.blockId,
    ...body,
  });

  res.status(201).json({ dayOfInterest: created });
}
