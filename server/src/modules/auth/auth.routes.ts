import { Router } from "express";
import { authRateLimiter } from "../../middleware/rateLimiter.js";
import { requireAuth } from "./auth.middleware.js";
import {
  googleLoginHandler,
  loginHandler,
  meHandler,
  signupHandler,
} from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/signup", authRateLimiter, signupHandler);
authRouter.post("/login", authRateLimiter, loginHandler);
authRouter.post("/google", authRateLimiter, googleLoginHandler);
authRouter.get("/me", requireAuth, meHandler);
