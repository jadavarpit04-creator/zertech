import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAuth(req?: NextRequest) {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    if (!session?.userId) throw new AuthError("No session");
    return { supabase: supabaseAdmin, user: { id: session.userId } };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError("Unauthorized");
  }
}
