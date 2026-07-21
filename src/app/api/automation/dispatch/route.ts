import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { syncEmails, detectInvoices, detectLeads } from "@/lib/gmail-service";
import { triggerInvoiceDraftCreation, triggerLeadDraftCreation } from "@/lib/activepieces-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/automation/dispatch
 *
 * Sabhi connected users ki Gmail scan kare, detect kare, aur ActivePieces ko
 * webhook call kare (Flow 1 / Flow 2 trigger karne ke liye).
 *
 * ActivePieces phir AI draft banayega aur backend ke /api/drafts/create ko
 * call karega (STOPS BEFORE SEND — PRD FR-5).
 *
 * Cron-job.org se har 10 min call karo: ?secret=CRON_SECRET
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

    // 1. Fetch all connected Gmail integrations
    const { data: integrations, error: intErr } = await supabase
      .from("integrations")
      .select("user_id, token_data")
      .eq("provider", "gmail")
      .eq("connected", true);

    if (intErr) throw new Error(`Failed to fetch integrations: ${intErr.message}`);
    if (!integrations?.length) {
      return NextResponse.json({ scanned: 0, message: "No connected users" });
    }

    // 2. Process each user
    for (const integration of integrations) {
      const userId = integration.user_id;
      const tokenData = integration.token_data as any;
      if (!tokenData?.accessToken) {
        results.push({ userId, status: "skipped_no_token" });
        continue;
      }

      try {
        // 3. Sync emails (last 1 hour)
        const emails = await syncEmails(
          tokenData.accessToken,
          tokenData.refreshToken || null,
          userId
        );

        if (emails.length === 0) {
          results.push({ userId, status: "ok", synced: 0 });
          continue;
        }

        // 4. Detect invoices and leads
        const invoices = detectInvoices(emails);
        const leads = detectLeads(emails);

        // 5. Dispatch to ActivePieces (yeh AI draft banayega + save karega)
        let invoiceDispatched = false;
        let leadDispatched = false;

        if (invoices.length > 0) {
          const items = invoices.map(inv => ({
            user_id: userId,
            gmail_access_token: tokenData.accessToken,
            client_name: inv.from.split("<")[0]?.trim() || inv.from,
            client_email: extractEmail(inv.from),
            invoice_number: extractInvoiceNumber(inv.subject) ?? undefined,
            amount: extractAmount(inv.subject + " " + inv.body_snippet) || 0,
            due_date: extractDueDate(inv.body_snippet) || new Date().toISOString().split("T")[0],
            tone: "friendly",
          }));
          invoiceDispatched = await triggerInvoiceDraftCreation(items);
        }

        if (leads.length > 0) {
          const items = leads.map(lead => ({
            user_id: userId,
            gmail_access_token: tokenData.accessToken,
            lead_name: lead.from.split("<")[0]?.trim() || lead.from,
            email: extractEmail(lead.from),
            inquiry_text: lead.body_snippet,
            tone: "professional",
            score: lead.score,
          }));
          leadDispatched = await triggerLeadDraftCreation(items);
        }

        results.push({
          userId,
          status: "ok",
          synced: emails.length,
          invoicesFound: invoices.length,
          invoiceDispatched,
          leadsFound: leads.length,
          leadDispatched,
        });
      } catch (e: any) {
        console.error(`[dispatch] Error user ${userId}:`, e.message);
        results.push({ userId, status: "error", error: e.message });
      }
    }

    return NextResponse.json({ scanned: integrations.length, results });
  } catch (err: any) {
    console.error("[dispatch] Fatal:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────
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
    if (match) return parseFloat(match[1].replace(/,/g, ""));
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
    if (match) return match[1];
  }
  return null;
}

function extractInvoiceNumber(text: string): string | null {
  const match = text.match(/(?:invoice|inv)\s*[#:.]?\s*([\w-]+)/i);
  return match ? match[1] : null;
}
