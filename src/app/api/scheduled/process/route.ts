import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { sendEmail } from "@/lib/gmail-service";
import { getGmailTokens } from "@/lib/integration-tokens";

export const dynamic = "force-dynamic";

/**
 * GET /api/scheduled/process
 *
 * Sends any drafts whose `scheduled_at` is in the past and status is "scheduled".
 * Designed to be called by a cron job (e.g. every 5 minutes).
 * Secured by an optional CRON_SECRET query param.
 */
export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const provided = req.nextUrl.searchParams.get("secret");
      if (provided !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = createRouteHandlerClient({ cookies });
    const now = new Date().toISOString();

    // Fetch due scheduled drafts
    const { data: due, error } = await supabase
      .from("drafts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (error) throw new Error(error.message);
    if (!due || due.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    const results = [];
    for (const draft of due) {
      const tokens = await getGmailTokens(supabase, draft.user_id);
      if (!tokens) {
        results.push({ id: draft.id, status: "skipped_no_token" });
        continue;
      }
      try {
        await sendEmail(tokens.accessToken, tokens.refreshToken, {
          to: draft.recipient_email,
          subject: draft.subject ?? "Follow-up",
          body: draft.body ?? "",
        });
        await supabase
          .from("drafts")
          .update({ status: "sent", sent_at: now })
          .eq("id", draft.id);
        await supabase.from("activity_log").insert({
          user_id: draft.user_id,
          action: "draft.sent",
          entity_type: draft.kind,
          entity_id: draft.source_id,
          meta: { draft_id: draft.id, sent_via: "gmail", scheduled: true },
        });
        results.push({ id: draft.id, status: "sent" });
      } catch (e: any) {
        results.push({ id: draft.id, status: "error", error: e.message });
      }
    }

    return NextResponse.json({ processed: due.length, results });
  } catch (err: any) {
    console.error("[scheduled/process]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
