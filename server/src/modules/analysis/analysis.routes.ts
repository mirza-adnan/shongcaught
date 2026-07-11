import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { listAlertsHandler, recomputeHandler } from "./analysis.controller.js";

export const analysisRouter = Router();

analysisRouter.use(requireAuth);

analysisRouter.get("/alerts", listAlertsHandler);
analysisRouter.post("/recompute", requireRole("ops"), recomputeHandler);
