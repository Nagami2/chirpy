import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { apiConfig } from "../config.js";

// Create the connection
const conn = postgres(apiConfig.dbURL);

// Export the "db" object to use in other files
export const db = drizzle(conn, { schema });
