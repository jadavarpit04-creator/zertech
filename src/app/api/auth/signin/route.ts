import { NextRequest, NextResponse } from "next/server";
import { workos } from "@/lib/workos";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const { user } = await workos.userManagement.authenticateWithPassword({
      email,
      password,
      clientId: process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID!,
    });

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
