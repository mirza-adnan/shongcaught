import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  alertActionHandler,
  listAlertsHandler,
  metricsHandler,
  recomputeHandler,
} from "./analysis.controller.js";

export const analysisRouter = Router();

// Public, no auth — judge/evaluation-facing evidence endpoint, same spirit as /api/simulation.
// Must stay registered before the requireAuth gate below.
analysisRouter.get("/metrics", metricsHandler);

analysisRouter.use(requireAuth);

analysisRouter.get("/alerts", listAlertsHandler);
analysisRouter.patch("/alerts/:id", requireRole("ops"), alertActionHandler);
analysisRouter.post("/recompute", requireRole("ops"), recomputeHandler);
