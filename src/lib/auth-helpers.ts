// Shared auth helper for API routes — uses Better-Auth to verify session.
import { auth } from "./auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase-admin";

export interface AuthResult {
  user: { id: string; email: string; name: string };
  supabase: SupabaseClient;
}

/**
 * Verify the request is authenticated via Better-Auth session.
 * Uses the Authorization header or cookies forwarded from the client.
 * On success returns the user + a Supabase admin client (service_role) for DB queries.
 */
export async function requireAuth(headers: Headers): Promise<AuthResult> {
  const session = await auth.api.getSession({ headers });

  if (!session || !session.user) {
    throw new AuthError("Unauthorized");
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? "",
    },
    supabase: supabaseAdmin,
  };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
