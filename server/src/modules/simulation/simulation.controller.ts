import type { Request, Response } from "express";
import { z } from "zod";
import * as simulationService from "./simulation.service.js";
import { SCENARIO_NAMES } from "./simulation.types.js";

const startSchema = z.object({
  speedMultiplier: z.number().positive().optional(),
});

const speedSchema = z.object({
  speedMultiplier: z.number().positive(),
});

const triggerSchema = z.object({
  blockId: z.string().uuid(),
  scenario: z.enum(SCENARIO_NAMES),
  provider: z.enum(["bkash", "nagad", "rocket"]),
  durationSeconds: z.number().positive().optional(),
});

export async function startHandler(req: Request, res: Response) {
  const { speedMultiplier } = startSchema.parse(req.body);
  const status = await simulationService.startSimulation(speedMultiplier);
  res.status(200).json(status);
}

export function stopHandler(_req: Request, res: Response) {
  const status = simulationService.stopSimulation();
  res.status(200).json(status);
}

export function speedHandler(req: Request, res: Response) {
  const { speedMultiplier } = speedSchema.parse(req.body);
  const status = simulationService.setSpeed(speedMultiplier);
  res.status(200).json(status);
}

export function statusHandler(_req: Request, res: Response) {
  res.status(200).json(simulationService.getStatus());
}

export function scenariosHandler(_req: Request, res: Response) {
  res.status(200).json(simulationService.listScenarios());
}

export async function triggerHandler(req: Request, res: Response) {
  const body = triggerSchema.parse(req.body);
  const status = await simulationService.triggerScenario(body);
  res.status(200).json(status);
}

export async function listBlocksHandler(_req: Request, res: Response) {
  const blocks = await simulationService.listBlocksForSelection();
  res.status(200).json({ blocks });
}
