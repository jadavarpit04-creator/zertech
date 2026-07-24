import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { syncEmails, detectInvoices, detectLeads } from "@/lib/gmail-service";
import { triggerInvoiceDraftCreation, triggerLeadDraftCreation } from "@/lib/activepieces-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const provided = req.nextUrl.searchParams.get("secret");
      if (provided !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Return immediately — process in background
    const result = NextResponse.json({
      status: "processing",
      message: "Scan started in background",
    });

    // Fire-and-forget background processing
    processInBackground().catch(err => {
      console.error("[dispatch] background fatal:", err);
    });

    return result;
  } catch (err: any) {
    console.error("[dispatch] Fatal:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function processInBackground() {
  const supabase = supabaseAdmin;
  const results: any[] = [];

  const { data: integrations, error: intErr } = await supabase
    .from("integrations")
    .select("user_id, token_data")
    .eq("provider", "gmail")
    .eq("connected", true);

  if (intErr) { console.error("[dispatch] DB error:", intErr.message); return; }
  if (!integrations?.length) { console.log("[dispatch] No connected users"); return; }

  for (const integration of integrations) {
    const userId = integration.user_id;
    const tokenData = integration.token_data as any;
    if (!tokenData?.accessToken) {
      results.push({ userId, status: "skipped_no_token" });
      continue;
    }

    try {
      const emails = await syncEmails(
        tokenData.accessToken,
        tokenData.refreshToken || null,
        userId
      );

      if (emails.length === 0) {
        results.push({ userId, status: "ok", synced: 0 });
        continue;
      }

      const invoices = detectInvoices(emails);
      const leads = detectLeads(emails);

      let invoiceDispatched = false;
      let leadDispatched = false;

      if (invoices.length > 0) {
        // Skip already-processed emails
        const gmailIds = invoices.map(i => i.gmail_id);
        const { data: existing } = await supabase
          .from("drafts")
          .select("source_message_id")
          .eq("user_id", userId)
          .in("source_message_id", gmailIds);
        const processedIds = new Set((existing || []).map(d => d.source_message_id));
        const newInvoices = invoices.filter(i => !processedIds.has(i.gmail_id));

        if (newInvoices.length > 0) {
          const items = newInvoices.map(inv => ({
            user_id: userId,
            gmail_access_token: tokenData.accessToken,
            client_name: inv.from.split("<")[0]?.trim() || inv.from,
            client_email: extractEmail(inv.from),
            invoice_number: extractInvoiceNumber(inv.subject) ?? undefined,
            amount: extractAmount(inv.subject + " " + inv.body_snippet) || 0,
            due_date: extractDueDate(inv.subject + " " + inv.body_snippet) || new Date().toISOString().split("T")[0],
            tone: "friendly",
            gmail_id: inv.gmail_id,
          }));
          invoiceDispatched = await triggerInvoiceDraftCreation(items);
        }
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
        userId, status: "ok", synced: emails.length,
        invoicesFound: invoices.length, invoiceDispatched,
        leadsFound: leads.length, leadDispatched,
      });
    } catch (e: any) {
      console.error(`[dispatch] Error user ${userId}:`, e.message);
      results.push({ userId, status: "error", error: e.message });
    }
  }

  console.log("[dispatch] Background scan complete:", JSON.stringify(results));
}

// ─── Helpers ────────────────────────────────────────────────

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from.trim();
}

function extractAmount(text: string): number | null {
  const patterns = [
    /(?:amount|total|sum|due)\s*[:₹$€]?\s*(\d[\d,]*)/i,
    /[₹$€]\s*(\d[\d,]*(?:\.\d+)?)/,
    /\b(\d{2,3}(?:,\d{3})*(?:\.\d{2})?)\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = match[1].replace(/,/g, "");
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

function extractDueDate(text: string): string | null {
  const patterns = [
    /(?:due\s*(?:date|on|by)?)\s*[:.]?\s*(\d{1,2})[\s\/.-](\d{1,2})[\s\/.-](\d{2,4})/i,
    /(?:due\s*(?:date|on|by)?)\s*[:.]?\s*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(\d{4})/i,
    /(?:due\s*(?:date|on|by)?)\s*[:.]?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})[\s,]+(\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern === patterns[3]) return match[1];
      let day: string, month: string, year: string;
      if (pattern === patterns[2]) { month = match[1]; day = match[2]; year = match[3]; }
      else { day = match[1]; month = match[2]; year = match[3]; }
      const months: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
        jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
      };
      const m = months[month.toLowerCase().slice(0, 3)] || month.padStart(2, "0");
      const d = day.padStart(2, "0");
      const y = year.length === 2 ? "20" + year : year;
      return `${y}-${m}-${d}`;
    }
  }
  return null;
}

function extractInvoiceNumber(text: string): string | null {
  const match = text.match(/(?:invoice|inv)\s*[#:.]?\s*([\w-]+)/i);
  return match ? match[1] : null;
}
