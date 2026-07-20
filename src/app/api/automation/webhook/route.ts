import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/automation/webhook
 *
 * Receives webhooks from ActivePieces automation platform.
 * Supports multiple trigger types:
 *   - draft.created: When a new draft is created
 *   - invoice.overdue: When an invoice becomes overdue
 *   - draft.sent: When a draft is sent
 *   - lead.new: When a new lead is detected
 *   - custom: Custom webhook payload
 *
 * ActivePieces should POST JSON with:
 *   { trigger: string, payload: object, api_key?: string }
 *
 * If ACTIVE_PIECES_API_KEY is set in env, webhooks without
 * a matching key are rejected.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trigger, payload, api_key } = body;

    if (!trigger) {
      return NextResponse.json({ error: "Missing trigger field" }, { status: 400 });
    }

    // API key validation is optional (ActivePieces free tier doesn't need it)
    // Set ACTIVE_PIECES_API_KEY in .env to enable auth
    const activePiecesKey = process.env.ACTIVE_PIECES_API_KEY;
    if (activePiecesKey && api_key !== activePiecesKey) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Validate trigger type
    const validTriggers = ["draft.created", "invoice.overdue", "draft.sent", "lead.new", "custom"];
    if (!validTriggers.includes(trigger)) {
      return NextResponse.json({ error: "Invalid trigger: " + trigger }, { status: 400 });
    }

    // Log the webhook event
    if (payload?.user_id) {
      await supabaseAdmin.from("activity_log").insert({
        user_id: payload.user_id,
        action: "automation.webhook_received",
        entity_type: "automation",
        meta: { trigger, provider: "activepieces", payload },
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      message: "Webhook received",
      trigger,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[ActivePieces webhook]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/automation/webhook
 * Health check endpoint for ActivePieces to verify connectivity.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "Zertech",
    version: "1.0.0",
    endpoints: {
      webhook: "POST /api/automation/webhook",
      triggers: "GET /api/automation/triggers",
      actions: "POST /api/automation/actions",
    },
  });
}