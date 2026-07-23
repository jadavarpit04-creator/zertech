import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as sheets from "@/lib/sheets-service";

/**
 * GET /api/sheets
 *   - Returns OAuth URL for connecting Google Sheets (no action param).
 *   - Or handles the OAuth callback redirect from Google (when ?code= is present).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    // --- OAuth callback from Google redirect ---
    if (code) {
      const { auth } = await import("@clerk/nextjs/server");
      const { userId } = await auth();

      if (!userId) {
        return NextResponse.redirect(new URL("/auth", req.url));
      }

      const redirectUri = `${req.nextUrl.origin}/api/sheets`;
      const tokens = await sheets.handleSheetsCallback(code, redirectUri);

      await supabaseAdmin.from("integrations").upsert(
        {
          user_id: userId,
          provider: "sheets",
          connected: true,
          meta: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date,
          },
        },
        { onConflict: "user_id,provider" }
      );

      await supabaseAdmin.from("activity_log").insert({
        user_id: userId,
        action: "integration.connected",
        entity_type: "integration",
        meta: { provider: "sheets" },
      });

      return NextResponse.redirect(new URL("/settings", req.url));
    }

    // --- Return OAuth URL for the frontend to redirect the user ---
    const redirectUri = `${req.nextUrl.origin}/api/sheets`;
    const url = sheets.initSheetsOAuth(redirectUri);
    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("[API sheets GET]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sheets?action=connect
 *   Exchange an OAuth authorization code for tokens (alternative to GET callback).
 *   Body: { code: string }
 *
 * POST /api/sheets?action=sync
 *   Append a row to the configured Google Sheet for a sent draft.
 *   Body: { draftId: string, spreadsheetId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? "connect";

    // ---------- Connect (OAuth code exchange) ----------
    if (action === "connect") {
      const { code } = await req.json();
      if (!code) {
        return NextResponse.json(
          { error: "Authorization code required" },
          { status: 400 }
        );
      }

      const redirectUri = `${req.nextUrl.origin}/api/sheets`;
      const tokens = await sheets.handleSheetsCallback(code, redirectUri);

      await supabase.from("integrations").upsert(
        {
          user_id: user.id,
          provider: "sheets",
          connected: true,
          meta: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date,
          },
        },
        { onConflict: "user_id,provider" }
      );

      await supabase.from("activity_log").insert({
        user_id: user.id,
        action: "integration.connected",
        entity_type: "integration",
        meta: { provider: "sheets" },
      });

      return NextResponse.json({ ok: true });
    }

    // ---------- Sync (append row for a sent draft) ----------
    if (action === "sync") {
      const { draftId, spreadsheetId } = await req.json();
      if (!draftId || !spreadsheetId) {
        return NextResponse.json(
          { error: "draftId and spreadsheetId are required" },
          { status: 400 }
        );
      }

      // Fetch the draft
      const { data: draft, error: draftError } = await supabase
        .from("drafts")
        .select("*")
        .eq("id", draftId)
        .single();

      if (draftError || !draft) {
        return NextResponse.json(
          { error: "Draft not found" },
          { status: 404 }
        );
      }

      // If this is an invoice draft, grab the invoice amount
      let amount = 0;
      let client = draft.recipient_name;
      if (draft.kind === "invoice" && draft.source_id) {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("amount, client_name")
          .eq("id", draft.source_id)
          .single();
        if (invoice) {
          amount = Number(invoice.amount);
          client = invoice.client_name;
        }
      }

      // Retrieve stored Google access token
      const { data: integration } = await supabase
        .from("integrations")
        .select("meta")
        .eq("user_id", user.id)
        .eq("provider", "sheets")
        .single();

      const accessToken = (integration?.meta as any)?.access_token;
      if (!accessToken) {
        return NextResponse.json(
          { error: "Google Sheets is not connected. Connect first." },
          { status: 400 }
        );
      }

      const now = new Date();
      const result = await sheets.appendFollowUpRow(
        accessToken,
        spreadsheetId,
        {
          date: now.toISOString().slice(0, 10),
          time: now.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          client,
          invoiceNumber: draft.source_id?.slice(0, 8) ?? "â€”",
          amount: `â‚¹${amount.toFixed(2)}`,
          status: draft.status,
        }
      );

      return NextResponse.json({ ok: true, updates: result.updates });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[API sheets POST]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
