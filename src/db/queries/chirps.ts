import { db } from "../index.js";
import { chirps, NewChirp } from "../schema.js";
import { eq, desc } from "drizzle-orm";

export async function createChirp(chirp: NewChirp) {
  const [record] = await db.insert(chirps).values(chirp).returning();
  return record;
}

export async function getAllChirps() {
  // newest first (createdAt)
  return await db.select().from(chirps).orderBy(desc(chirps.createdAt));
}

export async function getChirpById(id: string) {
  return await db.select().from(chirps).where(eq(chirps.id, id));
}

export async function deleteChirp(id: string) {
  await db.delete(chirps).where(eq(chirps.id, id));
}
