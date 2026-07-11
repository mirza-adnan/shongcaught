import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../../utils/jwt.js";
import { AppError } from "../../middleware/errorHandler.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: "agent" | "ops";
      agentId?: string | null;
      blockId?: string | null;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new AppError("Authentication required", 401);
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.userRole = payload.role;
    req.agentId = payload.agentId;
    req.blockId = payload.blockId;
    next();
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }
}

export function requireRole(role: "agent" | "ops") {
  return function (req: Request, _res: Response, next: NextFunction) {
    if (req.userRole !== role) {
      throw new AppError("Forbidden", 403);
    }
    next();
  };
}
