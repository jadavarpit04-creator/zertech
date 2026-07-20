import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db";
import * as authSchema from "./db/schema";

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8080",
  secret: process.env.BETTER_AUTH_SECRET ?? "zertech-dev-secret-change-in-prod-32chars!",
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user: authSchema.user,
      session: authSchema.session,
      account: authSchema.account,
      verification: authSchema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  rateLimit: {
    window: 60,
    max: 10,
  },
  events: {
    createUser: async (user: { id: string; name: string; email: string }) => {
      const { supabaseAdmin } = await import("@/lib/supabase-admin");
      await supabaseAdmin.from("profiles").upsert({
        id: user.id,
        full_name: user.name ?? "",
        company: "",
        team_size: "",
        plan: "starter",
      });
      await supabaseAdmin.from("workflow_settings").insert([
        { user_id: user.id, workflow: "invoice", approval_required: true, auto_send: false },
        { user_id: user.id, workflow: "lead", approval_required: true, auto_send: false },
      ]);
    },
  },
});
