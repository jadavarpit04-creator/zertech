import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ isNew: false });
  }

  // Check if user already has workflow_settings (created during onboarding)
  const { count, error } = await supabaseAdmin
    .from("workflow_settings")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.user.id);

  if (error) {
    console.error("check-new error:", error);
    return NextResponse.json({ isNew: true });
  }

  return NextResponse.json({ isNew: count === 0 || count === null });
}
