import { NextResponse } from "next/server";
import { workos } from "@/lib/workos";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const userId = cookieStore.get("wos_session")?.value;

    if (!userId) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = await workos.userManagement.getUser(userId);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: [user.firstName, user.lastName].filter(Boolean).join(" "),
        createdAt: user.createdAt,
        profile: profile ?? null,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
