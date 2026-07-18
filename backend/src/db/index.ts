import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Lazy singleton: only connect when DATABASE_URL is present (keeps build/tests clean).
let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy backend/.env.example to backend/.env");
  }
  _client = postgres(url, { prepare: false, max: 10 });
  _db = drizzle(_client, { schema });
  return _db;
}

export { schema };
