import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  scenariosHandler,
  speedHandler,
  startHandler,
  statusHandler,
  stopHandler,
  triggerHandler,
} from "./simulation.controller.js";

export const simulationRouter = Router();

simulationRouter.use(requireAuth, requireRole("ops"));

simulationRouter.get("/status", statusHandler);
simulationRouter.post("/start", startHandler);
simulationRouter.post("/stop", stopHandler);
simulationRouter.post("/speed", speedHandler);
simulationRouter.get("/scenarios", scenariosHandler);
simulationRouter.post("/scenarios/trigger", triggerHandler);
