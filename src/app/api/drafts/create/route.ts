import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/drafts/create
 *
 * ActivePieces (Flow 1/2) se call hota hai jab AI draft generate ho jaye.
 * Draft ko "pending" status me save karta hai — human approval ke liye.
 */
export async function POST(req: NextRequest) {
  try {
    // Allow calls from ActivePieces webhook
    const apSecret = process.env.AP_WEBHOOK_SECRET;
    if (apSecret) {
      const headerSecret = req.headers.get("x-webhook-secret");
      const querySecret = req.nextUrl.searchParams.get("secret");
      if (headerSecret !== apSecret && querySecret !== apSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { invoice_id, subject, body, status, user_id, lead_id, recipient_name, recipient_email } = await req.json();
    if (!user_id || !subject || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sourceId = invoice_id || lead_id || null;
    // source_id is UUID type — only set if valid UUID
    const safeSourceId = sourceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId) ? sourceId : null;
    const kind = invoice_id ? "invoice" : lead_id ? "lead" : "invoice";

    const { data: draft, error } = await supabaseAdmin
      .from("drafts")
      .insert({
        user_id,
        kind,
        source_id: safeSourceId,
        subject,
        body,
        status: status || "pending",
        recipient_name: recipient_name || "",
        recipient_email: recipient_email || "",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, draft_id: draft.id });
  } catch (err: any) {
    console.error("[drafts/create]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
