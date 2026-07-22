import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/drafts/create
 *
 * ActivePieces se call hota hai (Flow 1 & 2 ke last step).
 * AI draft generate karne ke baad ActivePieces yeh endpoint call karega
 * to save the draft with status "pending_approval".
 *
 * 🛑 Draft status hamesha "pending_approval" — kabhi "sent" nahi.
 *    Actual send FLOW 6 (send-after-approval) se hoga.
 *
 * Security: X-Webhook-Secret header required.
 */

const AP_SECRET = process.env.AP_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  try {
    // Security check
    const secret = req.headers.get("x-webhook-secret");
    if (AP_SECRET && secret !== AP_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { user_id, type, source_id, recipient_name, recipient_email, subject, body: draftBody } = body;

    if (!user_id || !type || !recipient_email || !subject) {
      return NextResponse.json({
        error: "Missing required fields: user_id, type, recipient_email, subject"
      }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    const { data: draft, error } = await supabase
      .from("drafts")
      .insert({
        user_id,
        kind: type, // "invoice" | "lead"
        source_id: source_id || null,
        recipient_name: recipient_name || "",
        recipient_email,
        subject,
        body: draftBody || "",
        status: "pending", // FR-5: koi direct send nahi — user approval required
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Log activity
    await supabase.from("activity_log").insert({
      user_id,
      action: `draft.created_${type}`,
      entity_type: type,
      entity_id: source_id || draft.id,
      meta: { draft_id: draft.id, subject },
    });

    return NextResponse.json({ ok: true, draft_id: draft.id });
  } catch (err: any) {
    console.error("[drafts/create]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
