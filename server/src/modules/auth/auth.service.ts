import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { AppError } from "../../middleware/errorHandler.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { signToken } from "../../utils/jwt.js";
import { verifyGoogleIdToken } from "./google.js";

export async function signup(email: string, password: string, name: string) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash, role: "agent" })
    .returning();

  const token = signToken({ userId: user.id });

  return { user: sanitizeUser(user), token };
}

export async function login(email: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!user || !user.passwordHash) {
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await comparePassword(password, user.passwordHash);

  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = signToken({ userId: user.id });

  return { user: sanitizeUser(user), token };
}

export async function loginWithGoogle(idToken: string) {
  const profile = await verifyGoogleIdToken(idToken);

  let user = await db.query.users.findFirst({ where: eq(users.googleId, profile.googleId) });

  if (!user) {
    user = await db.query.users.findFirst({ where: eq(users.email, profile.email) });
  }

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email: profile.email,
        name: profile.name,
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
        role: "agent",
      })
      .returning();
  } else if (!user.googleId) {
    [user] = await db
      .update(users)
      .set({ googleId: profile.googleId, avatarUrl: profile.avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
  }

  const token = signToken({ userId: user.id });

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
