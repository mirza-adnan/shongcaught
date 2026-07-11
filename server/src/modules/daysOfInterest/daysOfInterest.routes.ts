import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { createHandler, listHandler } from "./daysOfInterest.controller.js";

export const daysOfInterestRouter = Router();

daysOfInterestRouter.use(requireAuth);

daysOfInterestRouter.get("/", listHandler);
daysOfInterestRouter.post("/", requireRole("ops"), createHandler);
