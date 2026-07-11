import type { Request, Response } from "express";
import { z } from "zod";
import { generateText } from "./ai.service.js";

const generateSchema = z.object({
  prompt: z.string().min(1),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});

export async function generateHandler(req: Request, res: Response) {
  const body = generateSchema.parse(req.body);
  const result = await generateText(body);
  res.status(200).json(result);
}
