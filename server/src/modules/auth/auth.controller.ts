import type { Request, Response } from "express";
import { z } from "zod";
import * as authService from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.login(email, password);
  res.status(200).json(result);
}

export async function meHandler(req: Request, res: Response) {
  const user = await authService.getUserById(req.userId as string);
  res.status(200).json({ user });
}
