import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const AP_SECRET = process.env.AP_WEBHOOK_SECRET;

/**
 * POST /api/invoices/mark-sent
 *
 * ActivePieces (Flow 6) se call hota hai jab email successfully send ho jaye.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (AP_SECRET && secret !== AP_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { invoice_id: rawInvoiceId, related_id, draft_id, user_id } = await req.json();
    const invoice_id = rawInvoiceId || related_id;
    if (!invoice_id || !user_id) {
      return NextResponse.json({ error: "Missing invoice_id or user_id" }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    await supabase.from("invoices").update({ status: "reminded" }).eq("id", invoice_id);

    if (draft_id) {
      await supabase.from("drafts").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", draft_id);
    }

    await supabase.from("activity_log").insert({
      user_id,
      action: "invoice.reminder_sent",
      entity_type: "invoice",
      entity_id: invoice_id,
      meta: { draft_id, sent_via: "activepieces" },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[invoices/mark-sent]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/invoices/mark-sent
 *
 * ActivePieces (Flow 3 - escalation) overdue invoices fetch karne ke liye.
 * Returns sabhi overdue invoices jinka status "pending" ya "overdue" hai.
 */
export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (AP_SECRET && secret !== AP_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseAdmin;
    const today = new Date().toISOString().split("T")[0];

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, user_id, client_name, client_email, invoice_number, amount, due_date")
      .lt("due_date", today)
      .in("status", ["pending", "overdue"]);

    return NextResponse.json({ invoices: invoices ?? [] });
  } catch (err: any) {
    console.error("[invoices/mark-sent GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
