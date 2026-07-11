import { Router } from "express";
import { aiRateLimiter } from "../../middleware/rateLimiter.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { generateHandler } from "./ai.controller.js";

export const aiRouter = Router();

aiRouter.post("/generate", requireAuth, aiRateLimiter, generateHandler);
