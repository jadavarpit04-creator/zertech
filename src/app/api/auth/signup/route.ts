import { NextRequest, NextResponse } from "next/server";
import { workos } from "@/lib/workos";
import { supabaseAdmin } from "@/lib/supabase-admin";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, company, teamSize } = await req.json();
    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Email, password, and full name required" }, { status: 400 });
    }

    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    const user = await workos.userManagement.createUser({
      email,
      password,
      firstName,
      lastName,
    });

    // Hash password for our own auth (bypasses WorkOS email verification requirement)
    const passwordHash = await bcrypt.hash(password, 12);

    const { error: insertError } = await supabaseAdmin.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      company: company ?? null,
      team_size: teamSize ?? null,
      password_hash: passwordHash,
    });

    if (insertError) {
      console.error("[auth/signup] profile insert error:", insertError);
      // Don't fail the signup — profile can be created later
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
    console.error("[auth/signup]", err);
    return NextResponse.json(
      { error: err.message ?? err.errors?.[0]?.message ?? "Failed to create account" },
      { status: 400 }
    );
  }
}
