import { Router } from "express";
import { authRateLimiter } from "../../middleware/rateLimiter.js";
import { requireAuth } from "./auth.middleware.js";
import { loginHandler, meHandler } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", authRateLimiter, loginHandler);
authRouter.get("/me", requireAuth, meHandler);
