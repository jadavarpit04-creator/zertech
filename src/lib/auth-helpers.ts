import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAuth() {
  const cookieStore = cookies();
  const userId = cookieStore.get("wos_session")?.value;
  if (!userId) throw new AuthError("Unauthorized");
  return { supabase: supabaseAdmin, user: { id: userId } };
}

export async function getCurrentUser() {
  const cookieStore = cookies();
  const userId = cookieStore.get("wos_session")?.value;
  return userId ?? null;
}
