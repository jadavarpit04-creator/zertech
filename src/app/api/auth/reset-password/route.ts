import { NextRequest, NextResponse } from "next/server";
import { workos } from "@/lib/workos";

export async function POST(req: NextRequest) {
  try {
    const { newPassword, token } = await req.json();
    if (!newPassword || !token) {
      return NextResponse.json({ error: "Password and token required" }, { status: 400 });
    }

    await workos.userManagement.resetPassword({
      token,
      newPassword,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[auth/reset-password]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to reset password" },
      { status: 400 }
    );
  }
}
