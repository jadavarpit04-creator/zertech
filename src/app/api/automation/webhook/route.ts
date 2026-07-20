import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/automation/webhook
 *
 * Receives webhooks from external automation platforms.
 * Supports multiple trigger types:
 *   - draft.created: When a new draft is created
 *   - invoice.overdue: When an invoice becomes overdue
 *   - draft.sent: When a draft is sent
 *   - lead.new: When a new lead is detected
 *   - custom: Custom webhook payload
 *
 * Expects JSON body: { trigger: string, payload: object, api_key?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trigger, payload, api_key } = body;

    if (!trigger) {
      return NextResponse.json({ error: "Missing trigger field" }, { status: 400 });
    }

    const webhookApiKey = process.env.WEBHOOK_API_KEY;
    if (webhookApiKey && api_key !== webhookApiKey) {
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
        meta: { trigger, payload },
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Webhook received",
      trigger,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Webhook]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/automation/webhook
 * Health check endpoint for webhook connectivity.
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

