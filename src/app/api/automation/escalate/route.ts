import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getGmailTokens } from "@/lib/integration-tokens";
import { generateInvoiceDraft, getEscalationTone, getEscalationLabel } from "@/lib/ai-service";
import { sendEmail } from "@/lib/gmail-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/automation/escalate
 *
 * Checks overdue invoices for ALL users and creates escalation drafts.
 * - Day 3 overdue → 2nd reminder (Professional tone)
 * - Day 7 overdue → 3rd reminder (Firm + "Final Notice")
 * - Day 14 overdue → Flag for manual review
 *
 * Called by Vercel Cron (every 1 hour).
 * Secured by CRON_SECRET query param.
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

    const supabase = supabaseAdmin;
    const results: any[] = [];

    // Fetch ALL pending invoices that are overdue
    const { data: invoices, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .neq("status", "paid")
      .neq("status", "archived");

    if (invErr) throw new Error(`Failed to fetch invoices: ${invErr.message}`);
    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ escalated: 0, message: "No overdue invoices found" });
    }

    for (const invoice of invoices) {
      try {
        // Calculate overdue days
        const dueDate = new Date(invoice.due_date);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue < 3) continue; // Not yet due for escalation

        // Check if an escalation draft already exists for this escalation stage
        const escalationDays = daysOverdue >= 30 ? 30 : daysOverdue >= 14 ? 14 : daysOverdue >= 7 ? 7 : daysOverdue >= 3 ? 3 : 0;
        
        if (escalationDays === 0) continue;

        // Check if we already sent a draft for this stage
        const stageKey = `escalation_day_${escalationDays}`;
        const { data: existing } = await supabase
          .from("activity_log")
          .select("id")
          .eq("user_id", invoice.user_id)
          .eq("entity_id", invoice.id)
          .eq("action", stageKey)
          .maybeSingle();

        if (existing) continue; // Already escalated for this stage

        const tone = getEscalationTone(daysOverdue);

        // Generate escalation draft
        const draft = await generateInvoiceDraft(tone, {
          client_name: invoice.client_name,
          amount: invoice.amount,
          due_date: invoice.due_date,
          days_overdue: daysOverdue,
          invoice_id: invoice.invoice_number,
        });

        // Determine if this should auto-send or wait for approval
        const shouldAutoSend = daysOverdue >= 30; // Final notice auto-sends

        // Insert escalation draft
        const { data: draftRec, error: draftErr } = await supabase
          .from("drafts")
          .insert({
            user_id: invoice.user_id,
            kind: "invoice",
            source_id: invoice.id,
            recipient_name: invoice.client_name,
            recipient_email: invoice.client_email,
            subject: draft.subject,
            body: draft.body,
            status: shouldAutoSend ? "scheduled" : "pending",
            scheduled_at: shouldAutoSend ? new Date().toISOString() : null,
          })
          .select()
          .single();

        if (draftErr) throw draftErr;

        // If final notice, auto-send immediately
        if (shouldAutoSend) {
          try {
            const tokens = await getGmailTokens(supabase, invoice.user_id);
            if (tokens) {
              await sendEmail(tokens.accessToken, tokens.refreshToken, {
                to: invoice.client_email,
                subject: draft.subject,
                body: draft.body,
              });

              await supabase
                .from("drafts")
                .update({ status: "sent", sent_at: new Date().toISOString() })
                .eq("id", draftRec.id);

              await supabase
                .from("invoices")
                .update({ status: "escalated" })
                .eq("id", invoice.id);
            }
          } catch (e: any) {
            console.error(`[escalate] Auto-send failed for invoice ${invoice.id}:`, e.message);
          }
        }

        // Update invoice status
        if (daysOverdue >= 14) {
          await supabase
            .from("invoices")
            .update({ status: "manual_review" })
            .eq("id", invoice.id);
        }

        // Log escalation action
        await supabase.from("activity_log").insert({
          user_id: invoice.user_id,
          action: stageKey,
          entity_type: "invoice",
          entity_id: invoice.id,
          meta: {
            days_overdue: daysOverdue,
            tone,
            draft_id: draftRec.id,
            auto_sent: shouldAutoSend,
          },
        });

        results.push({
          invoice_id: invoice.id,
          daysOverdue,
          stage: stageKey,
          tone,
          draft_id: draftRec.id,
          auto_sent: shouldAutoSend,
          status: "ok",
        });
      } catch (e: any) {
        console.error(`[escalate] Error processing invoice ${invoice.id}:`, e.message);
        results.push({ invoice_id: invoice.id, status: "error", error: e.message });
      }
    }

    return NextResponse.json({ processed: invoices.length, escalated: results.length, results });
  } catch (err: any) {
    console.error("[escalate] Fatal error:", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
