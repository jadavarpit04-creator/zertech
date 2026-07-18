import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (db) return db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  const client = postgres(connectionString);
  db = drizzle(client, { schema });
  return db;
}
