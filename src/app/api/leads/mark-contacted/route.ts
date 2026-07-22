import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const AP_SECRET = process.env.AP_WEBHOOK_SECRET;

/**
 * POST /api/leads/mark-contacted
 *
 * ActivePieces (Flow 6) se call hota hai jab lead follow-up send ho jaye.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (AP_SECRET && secret !== AP_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lead_id: rawLeadId, related_id, draft_id, user_id } = await req.json();
    const lead_id = rawLeadId || related_id;
    if (!lead_id || !user_id) {
      return NextResponse.json({ error: "Missing lead_id or user_id" }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    await supabase.from("leads").update({ status: "contacted" }).eq("id", lead_id);

    if (draft_id) {
      await supabase.from("drafts").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", draft_id);
    }

    await supabase.from("activity_log").insert({
      user_id,
      action: "lead.followup_sent",
      entity_type: "lead",
      entity_id: lead_id,
      meta: { draft_id, sent_via: "activepieces" },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[leads/mark-contacted]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
