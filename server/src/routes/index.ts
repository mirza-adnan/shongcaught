import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { aiRouter } from "../modules/ai/ai.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/ai", aiRouter);
