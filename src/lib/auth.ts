import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDb } from "@/lib/db";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8080",
  secret: process.env.BETTER_AUTH_SECRET ?? "zertech-dev-secret-change-in-prod-32chars!",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },
  rateLimit: {
    window: 60,
    max: 10,
  },
  database: getDb()
    ? drizzleAdapter(getDb()!, {
        provider: "pg",
      })
    : undefined,
});
