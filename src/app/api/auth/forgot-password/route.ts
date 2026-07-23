import { NextRequest, NextResponse } from "next/server";
import { workos } from "@/lib/workos";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    await workos.userManagement.createPasswordReset({ email });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[auth/forgot-password]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to send reset email" },
      { status: 400 }
    );
  }
}
