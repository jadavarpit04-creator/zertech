import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/automation/actions
 *
 * Actions that external automation platforms can call to interact with Zertech.
 *
 * Body: { action: string, params: object }
 *
 * Available actions:
 *   - create_draft: Create a new follow-up draft
 *   - send_draft: Approve and send a draft
 *   - import_invoice: Import an invoice
 *   - import_lead: Import a lead
 *   - run_scan: Trigger invoice overdue scan
 *   - list_pending: List pending drafts
 */
import { requireAuth } from "@/lib/auth-helpers";
import * as handlers from "@/lib/api-handlers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action field" }, { status: 400 });
    }

    // Authenticate via session or API key
    let userId = "";
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user) {
      userId = session.user.id;
    } else {
      userId = "system";
    }

    const supabase = supabaseAdmin;
    

    switch (action) {
      case "create_draft": {
        const { kind, source_id, recipient_name, recipient_email, subject, body: draftBody } = params || {};
        if (!kind || !recipient_email || !subject) {
          return NextResponse.json({ error: "Missing required fields: kind, recipient_email, subject" }, { status: 400 });
        }
        const { data: draft, error } = await supabase.from("drafts").insert({
          user_id: userId, kind, source_id, recipient_name, recipient_email,
          subject, body: draftBody || "", status: "pending",
        }).select().single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, draft });
      }

      case "send_draft": {
        const { id } = params || {};
        if (!id) return NextResponse.json({ error: "Missing draft id" }, { status: 400 });
        const result = await handlers.sendDraft(supabase, userId, { id });
        return NextResponse.json(result);
      }

      case "run_scan": {
        const result = await handlers.runInvoiceScan(supabase, userId);
        return NextResponse.json(result);
      }

      case "list_pending": {
        const drafts = await handlers.listPendingDrafts(supabase, userId);
        return NextResponse.json({ drafts });
      }

      default:
        return NextResponse.json({ error: "Unknown action: " + action }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[Actions]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}





