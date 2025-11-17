import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Point to your schema file
  schema: "./src/db/schema.ts",
  // Where to save the generated SQL files
  out: "./drizzle",
  // Your database dialect
  dialect: "postgresql",
  dbCredentials: {
    // This string matches your Docker setup:
    // postgres://user:password@host:port/db_name?sslmode=disable
    url: "postgres://postgres:postgres@localhost:5432/chirpy?sslmode=disable",
  },
});
