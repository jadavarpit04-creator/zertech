import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { syncEmails, detectInvoices, detectLeads } from "@/lib/gmail-service";
import { getGmailTokens } from "@/lib/integration-tokens";
import { generateInvoiceDraft, generateLeadDraft, getEscalationTone } from "@/lib/ai-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min timeout

/**
 * GET /api/automation/scan
 *
 * Scans ALL connected Gmail inboxes for new emails, detects invoices/leads,
 * generates AI drafts, and inserts them into Supabase.
 *
 * Called by Vercel Cron (every 5 min).
 * Secured by CRON_SECRET query param.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Security check
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const provided = req.nextUrl.searchParams.get("secret");
      if (provided !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = supabaseAdmin;
    const results: any[] = [];

    // 2. Fetch all connected Gmail integrations
    const { data: integrations, error: intErr } = await supabase
      .from("integrations")
      .select("user_id, token_data")
      .eq("provider", "gmail")
      .eq("connected", true);

    if (intErr) throw new Error(`Failed to fetch integrations: ${intErr.message}`);
    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ scanned: 0, message: "No connected users found" });
    }

    // 3. Process each user
    for (const integration of integrations) {
      const userId = integration.user_id;
      const tokenData = integration.token_data as any;

      if (!tokenData?.accessToken) {
        results.push({ userId, status: "skipped_no_token" });
        continue;
      }

      try {
        // 3a. Sync emails (last 1 hour)
        const emails = await syncEmails(
          tokenData.accessToken,
          tokenData.refreshToken || null,
          userId
        );

        if (emails.length === 0) {
          results.push({ userId, status: "ok", synced: 0, invoices: 0, leads: 0 });
          continue;
        }

        // 3b. Detect invoices and leads
        const invoices = detectInvoices(emails);
        const leads = detectLeads(emails);

        let invoicesCreated = 0;
        let leadsCreated = 0;
        let draftsCreated = 0;

        // 3c. Process detected invoices
        for (const inv of invoices) {
          try {
            // Extract data from email
            const clientName = inv.from.split("<")[0]?.trim() || inv.from;
            const clientEmail = extractEmail(inv.from);
            const amount = extractAmount(inv.subject + " " + inv.body_snippet);
            const dueDate = extractDueDate(inv.body_snippet);

            // Generate AI draft
            const draft = await generateInvoiceDraft("friendly", {
              client_name: clientName,
              amount: amount || 0,
              due_date: dueDate || new Date().toISOString().split("T")[0],
              days_overdue: 0,
              invoice_id: extractInvoiceNumber(inv.subject) ?? undefined,
            });

            // Insert invoice record
            const { data: invoiceRec, error: invErr } = await supabase
              .from("invoices")
              .insert({
                user_id: userId,
                client_name: clientName,
                client_email: clientEmail,
                invoice_number: extractInvoiceNumber(inv.subject),
                amount: amount || 0,
                due_date: dueDate || null,
                status: "pending",
                original_email_subject: inv.subject,
                meta: { source: "automation_scan", gmail_id: inv.gmail_id, tone: "friendly" },
              })
              .select()
              .single();

            if (invErr) throw invErr;
            invoicesCreated++;

            // Insert draft
            const { error: draftErr } = await supabase.from("drafts").insert({
              user_id: userId,
              kind: "invoice",
              source_id: invoiceRec.id,
              recipient_name: clientName,
              recipient_email: clientEmail,
              subject: draft.subject,
              body: draft.body,
              status: "pending",
            });

            if (draftErr) throw draftErr;
            draftsCreated++;

            // Log activity
            await supabase.from("activity_log").insert({
              user_id: userId,
              action: "automation.invoice_detected",
              entity_type: "invoice",
              entity_id: invoiceRec.id,
              meta: { gmail_id: inv.gmail_id, subject: inv.subject },
            });
          } catch (e: any) {
            console.error(`[scan] Invoice processing error for user ${userId}:`, e.message);
          }
        }

        // 3d. Process detected leads
        for (const lead of leads) {
          try {
            const leadName = lead.from.split("<")[0]?.trim() || lead.from;
            const leadEmail = extractEmail(lead.from);

            // Generate AI draft
            const draft = await generateLeadDraft("professional", {
              lead_name: leadName,
              source: "Email",
              notes: lead.body_snippet.slice(0, 200),
            });

            // Insert lead record
            const { data: leadRec, error: leadErr } = await supabase
              .from("leads")
              .insert({
                user_id: userId,
                name: leadName,
                email: leadEmail,
                source: "Email Automation",
                score: lead.score,
                status: "new",
                notes: lead.body_snippet.slice(0, 500),
              })
              .select()
              .single();

            if (leadErr) throw leadErr;
            leadsCreated++;

            // Insert draft
            const { error: draftErr } = await supabase.from("drafts").insert({
              user_id: userId,
              kind: "lead",
              source_id: leadRec.id,
              recipient_name: leadName,
              recipient_email: leadEmail,
              subject: draft.subject,
              body: draft.body,
              status: "pending",
            });

            if (draftErr) throw draftErr;
            draftsCreated++;

            // Log activity
            await supabase.from("activity_log").insert({
              user_id: userId,
              action: "automation.lead_detected",
              entity_type: "lead",
              entity_id: leadRec.id,
              meta: { gmail_id: lead.gmail_id, score: lead.score, subject: lead.subject },
            });
          } catch (e: any) {
            console.error(`[scan] Lead processing error for user ${userId}:`, e.message);
          }
        }

        results.push({
          userId,
          status: "ok",
          synced: emails.length,
          invoicesFound: invoices.length,
          invoicesCreated,
          leadsFound: leads.length,
          leadsCreated,
          draftsCreated,
        });
      } catch (e: any) {
        console.error(`[scan] Error processing user ${userId}:`, e.message);
        results.push({ userId, status: "error", error: e.message });
      }
    }

    return NextResponse.json({ scanned: integrations.length, results });
  } catch (err: any) {
    console.error("[scan] Fatal error:", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}

// ─── Helper functions ───────────────────────────────────────

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from.trim();
}

function extractAmount(text: string): number | null {
  const patterns = [
    /(?:amount|total|sum|due)\s*[:₹$€]?\s*([\d,]+(?:\.\d{2})?)/i,
    /[₹$€]\s*([\d,]+(?:\.\d{2})?)/,
    /(\d[\d,]*\.\d{2})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ""));
    }
  }
  return null;
}

function extractDueDate(text: string): string | null {
  const patterns = [
    /(?:due\s*(?:date|on|by)?)\s*[:]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /(?:due\s*(?:date|on|by)?)\s*[:]?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function extractInvoiceNumber(text: string): string | null {
  const match = text.match(/(?:invoice|inv)\s*[#:.]?\s*([\w-]+)/i);
  return match ? match[1] : null;
}
