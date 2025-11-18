import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { refreshTokens } from "../schema.js";

export async function createRefreshToken(token: string, userId: string, expiresAt: Date) {
  await db.insert(refreshTokens).values({
    token,
    userId,
    expiresAt,
  });
}

export async function getRefreshToken(token: string){
  const result = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token));
  return result[0];
}

export async function revokeRefreshToken(token: string){
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.token, token));
}
