import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../middleware/errorHandler.js";
import * as agentsService from "./agents.service.js";

const updateCashSchema = z.object({
  balance: z.number().nonnegative(),
  note: z.string().max(500).optional(),
});

export async function meHandler(req: Request, res: Response) {
  if (!req.agentId) throw new AppError("Account is not linked to an agent", 403);

  const agent = await agentsService.getAgentSelf(req.agentId);
  res.status(200).json({ agent });
}

export async function listHandler(req: Request, res: Response) {
  if (!req.blockId) throw new AppError("Account is not linked to a block", 403);

  const [block, agentsInBlock] = await Promise.all([
    agentsService.getBlock(req.blockId),
    agentsService.listBlockAgents(req.blockId),
  ]);

  res.status(200).json({ block, agents: agentsInBlock });
}

export async function meTransactionsHandler(req: Request, res: Response) {
  if (!req.agentId) throw new AppError("Account is not linked to an agent", 403);

  const transactions = await agentsService.getRecentTransactionsForAgent(req.agentId);
  res.status(200).json({ transactions });
}

export async function updateMeCashHandler(req: Request, res: Response) {
  if (!req.agentId) throw new AppError("Account is not linked to an agent", 403);

  const { balance, note } = updateCashSchema.parse(req.body);
  const agent = await agentsService.updateCashBalance(req.agentId, balance, note);

  res.status(200).json({ agent });
}
