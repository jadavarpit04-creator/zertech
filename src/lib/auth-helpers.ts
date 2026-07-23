import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAuth() {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    throw new AuthError("Unauthorized");
  }
  return { supabase: supabaseAdmin, user: { id: userId } };
}

export async function getCurrentUser() {
  return currentUser();
}
