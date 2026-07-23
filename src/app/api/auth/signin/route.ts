import { NextRequest, NextResponse } from "next/server";
import { workos } from "@/lib/workos";
import { supabaseAdmin } from "@/lib/supabase-admin";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Look up user by email in WorkOS
    const { data: users } = await workos.userManagement.listUsers({ email });
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const user = users[0];

    // Verify password against stored hash in profiles table
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("password_hash")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.password_hash) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, userId: user.id });
    response.cookies.set("wos_session", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (err: any) {
    console.error("[auth/signin]", err);
    return NextResponse.json(
      { error: err.message ?? err.errors?.[0]?.message ?? "Invalid email or password" },
      { status: 401 }
    );
  }
}
