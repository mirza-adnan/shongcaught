import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { AppError } from "../../middleware/errorHandler.js";
import { comparePassword } from "../../utils/password.js";
import { signToken } from "../../utils/jwt.js";

export async function login(email: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!user || !user.passwordHash) {
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await comparePassword(password, user.passwordHash);

  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    agentId: user.agentId,
    blockId: user.blockId,
  });

  return { user: sanitizeUser(user), token };
}

export async function getUserById(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return sanitizeUser(user);
}

function sanitizeUser(user: typeof users.$inferSelect) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
