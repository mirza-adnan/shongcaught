import { Router } from "express";
import {
  listBlocksHandler,
  scenariosHandler,
  speedHandler,
  startHandler,
  statusHandler,
  stopHandler,
  triggerHandler,
} from "./simulation.controller.js";

export const simulationRouter = Router();

simulationRouter.get("/status", statusHandler);
simulationRouter.post("/start", startHandler);
simulationRouter.post("/stop", stopHandler);
simulationRouter.post("/speed", speedHandler);
simulationRouter.get("/scenarios", scenariosHandler);
simulationRouter.post("/scenarios/trigger", triggerHandler);
simulationRouter.get("/blocks", listBlocksHandler);
