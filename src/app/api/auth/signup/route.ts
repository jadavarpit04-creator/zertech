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

    // Create user in WorkOS without password — we handle auth ourselves via bcrypt
    const user = await workos.userManagement.createUser({
      email,
      firstName,
      lastName,
    });

    // Hash password for our own auth (bypasses WorkOS email verification requirement)
    const passwordHash = await bcrypt.hash(password, 12);

    // Direct fetch to Supabase REST API — supabaseAdmin client was failing silently
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          id: user.id,
          full_name: fullName,
          company: company ?? null,
          team_size: teamSize ?? null,
          password_hash: passwordHash,
        }),
      }
    );

    if (!upsertRes.ok) {
      console.error("[auth/signup] profile upsert error:", await upsertRes.text());
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
