import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { handleGmailCallback } from "@/lib/gmail-service";

/**
 * GET /api/gmail/callback
 *
 * Google OAuth redirects here with ?code= after user consents.
 * Exchanges the code for tokens, stores them in the integrations table,
 * then redirects the user to /settings?gmail=connected.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(
        new URL("/settings?gmail=error&reason=missing_code", req.url)
      );
    }

    // Exchange the auth code for tokens
    const tokens = await handleGmailCallback(code);

    // Store tokens in the integrations table
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      // No session — redirect to auth with an error
      return NextResponse.redirect(
        new URL("/auth?error=session_required", req.url)
      );
    }

    const { error: upsertError } = await supabase.from("integrations").upsert(
      {
        user_id: session.user.id,
        provider: "gmail",
        connected: true,
        token_data: tokens,
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      console.error("[Gmail callback] Upsert error:", upsertError);
      return NextResponse.redirect(
        new URL("/settings?gmail=error&reason=store_failed", req.url)
      );
    }

    // Log the integration activity
    await supabase.from("activity_log").insert({
      user_id: session.user.id,
      action: "integration.connected",
      entity_type: "integration",
      meta: { provider: "gmail" },
    });

    return NextResponse.redirect(
      new URL("/settings?gmail=connected", req.url)
    );
  } catch (err: any) {
    console.error("[Gmail callback GET]", err);
    return NextResponse.redirect(
      new URL("/settings?gmail=error&reason=" + encodeURIComponent(err.message ?? "unknown"), req.url)
    );
  }
}

/**
 * POST /api/gmail/callback
 *
 * Alternative entrypoint for client-side code exchange.
 * Body: { code: string }
 * Returns JSON { ok: true } on success.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    const tokens = await handleGmailCallback(code);

    const { error: upsertError } = await supabase.from("integrations").upsert(
      {
        user_id: session.user.id,
        provider: "gmail",
        connected: true,
        token_data: tokens,
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      return NextResponse.json(
        { error: `Failed to store tokens: ${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Gmail callback POST]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
