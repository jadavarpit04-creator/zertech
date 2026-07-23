import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  handleGmailCallback,
  syncEmails,
  detectInvoices,
  detectLeads,
} from "@/lib/gmail-service";

/**
 * GET /api/gmail/callback
 *
 * Google OAuth redirects here with ?code= after user consents.
 * Exchanges the code for tokens, stores them in the integrations table,
 * triggers an initial sync + invoice/lead detection, then redirects
 * the user to /settings?gmail=connected.
 *
 * The user's Better-Auth session cookie is forwarded with the redirect,
 * so we can identify them via the session.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(
        new URL("/settings?gmail=error&reason=missing_code", req.url)
      );
    }

    // Exchange the auth code for tokens
    const tokens = await handleGmailCallback(code, req.nextUrl.origin);

    // Identify user from Clerk session
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.redirect(
        new URL("/auth?error=session_required", req.url)
      );
    }

    // Fetch the user's Gmail profile to get email address
    let emailAddress = "";
    try {
      const profileRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
      );
      if (profileRes.ok) {
        const profile = await profileRes.json();
        emailAddress = profile.emailAddress ?? "";
      }
    } catch (e: any) {
      console.error("[Gmail callback] Failed to fetch profile:", e.message);
    }

    // Store tokens & meta
    const { error: upsertError } = await supabaseAdmin.from("integrations").upsert(
      {
        user_id: userId,
        provider: "gmail",
        connected: true,
        token_data: tokens,
        meta: {
          email_address: emailAddress,
          last_synced: new Date().toISOString(),
        },
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      console.error("[Gmail callback] Upsert error:", upsertError);
      return NextResponse.redirect(
        new URL("/settings?gmail=error&reason=store_failed", req.url)
      );
    }

    // Log activity
    await supabaseAdmin.from("activity_log").insert({
      user_id: userId,
      action: "integration.connected",
      entity_type: "integration",
      meta: { provider: "gmail" },
    });

    // Initial sync and detection
    try {
      const emails = await syncEmails(
        tokens.accessToken,
        tokens.refreshToken,
        userId
      );

      if (emails.length > 0) {
        const invoices = detectInvoices(emails);
        const leads = detectLeads(emails);

        await Promise.all([
          ...invoices.map((inv) => storeInvoice(supabaseAdmin, userId, inv)),
          ...leads.map((lead) => storeLead(supabaseAdmin, userId, lead)),
        ]);
      }
    } catch (syncErr) {
      console.error("[Gmail callback] Background sync failed:", syncErr);
    }

    return NextResponse.redirect(
      new URL("/settings?gmail=connected", req.url)
    );
  } catch (err: any) {
    console.error("[Gmail callback GET]", err);
    return NextResponse.redirect(
      new URL("/settings?gmail=error&reason=" + encodeURIComponent(err.message ?? "unknown"), req.url)
    );
  }
}

/**
 * POST /api/gmail/callback
 *
 * Alternative entrypoint for client-side code exchange.
 * Body: { code: string }
 * Returns JSON { ok: true } on success.
 */
export async function POST(req: NextRequest) {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    const tokens = await handleGmailCallback(code, req.nextUrl.origin);

    // Fetch the user's Gmail profile to get email address
    let emailAddress = "";
    try {
      const profileRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
      );
      if (profileRes.ok) {
        const profile = await profileRes.json();
        emailAddress = profile.emailAddress ?? "";
      }
    } catch (e: any) {
      console.error("[Gmail callback] Failed to fetch profile:", e.message);
    }

    const { error: upsertError } = await supabaseAdmin.from("integrations").upsert(
      {
        user_id: userId,
        provider: "gmail",
        connected: true,
        token_data: tokens,
        meta: {
          email_address: emailAddress,
          last_synced: new Date().toISOString(),
        },
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      return NextResponse.json(
        { error: `Failed to store tokens: ${upsertError.message}` },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("activity_log").insert({
      user_id: userId,
      action: "integration.connected",
      entity_type: "integration",
      meta: { provider: "gmail" },
    });

    // Initial sync and detection
    try {
      const emails = await syncEmails(
        tokens.accessToken,
        tokens.refreshToken,
        userId
      );

      if (emails.length > 0) {
        const invoices = detectInvoices(emails);
        const leads = detectLeads(emails);

        await Promise.all([
          ...invoices.map((inv) => storeInvoice(supabaseAdmin, userId, inv)),
          ...leads.map((lead) => storeLead(supabaseAdmin, userId, lead)),
        ]);
      }
    } catch (syncErr) {
      console.error("[Gmail callback POST] Sync failed:", syncErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Gmail callback POST]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function storeInvoice(supabase: typeof supabaseAdmin, userId: string, inv: import("@/lib/gmail-service").DetectedInvoice) {
  const clientName = inv.from.split("<")[0]?.trim() || inv.from;
  const clientEmail = extractEmail(inv.from);
  const amount = extractAmount(inv.subject + " " + inv.body_snippet);
  const dueDate = extractDueDate(inv.body_snippet);

  const { error } = await supabase.from("invoices").insert({
    user_id: userId,
    client_name: clientName,
    client_email: clientEmail,
    invoice_number: extractInvoiceNumber(inv.subject),
    amount: amount || 0,
    due_date: dueDate || null,
    status: "pending",
    original_email_subject: inv.subject,
    meta: { source: "oauth_callback", gmail_id: inv.gmail_id },
  });

  if (error) {
    console.error("[storeInvoice]", error);
  }
}

async function storeLead(supabase: typeof supabaseAdmin, userId: string, lead: import("@/lib/gmail-service").DetectedLead) {
  const leadName = lead.from.split("<")[0]?.trim() || lead.from;
  const leadEmail = extractEmail(lead.from);

  const { error } = await supabase.from("leads").insert({
    user_id: userId,
    name: leadName,
    email: leadEmail,
    source: "Email (OAuth)",
    score: lead.score,
    status: "new",
    notes: lead.body_snippet.slice(0, 500),
  });

  if (error) {
    console.error("[storeLead]", error);
  }
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from.trim();
}

function extractAmount(text: string): number | null {
  const patterns = [
    /(?:amount|total|sum|due)\s*[:â‚¹$â‚¬]?\s*([\d,]+(?:\.\d{2})?)/i,
    /[â‚¹$â‚¬]\s*([\d,]+(?:\.\d{2})?)/,
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
