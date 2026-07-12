import { Router } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { listHandler, meHandler, meTransactionsHandler, updateMeCashHandler } from "./agents.controller.js";

export const agentsRouter = Router();

agentsRouter.use(requireAuth);

agentsRouter.get("/me", requireRole("agent"), meHandler);
agentsRouter.get("/me/transactions", requireRole("agent"), meTransactionsHandler);
agentsRouter.patch("/me/cash", requireRole("agent"), updateMeCashHandler);
agentsRouter.get("/", requireRole("ops"), listHandler);
