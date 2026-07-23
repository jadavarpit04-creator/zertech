import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import {
  initGmailOAuth,
  handleGmailCallback,
  syncEmails,
  detectInvoices,
  detectLeads,
} from "@/lib/gmail-service";
import {
  insertEmails,
  getStoredEmails,
  updateEmailDetection,
} from "@/lib/email-store";

// â”€â”€â”€ GET /api/gmail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Returns the Google OAuth consent URL. The frontend redirects the
// user to this URL to begin the Gmail connection flow.

export async function GET(req: NextRequest) {
  try {
    const url = initGmailOAuth(req.nextUrl.origin);
    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("[Gmail GET]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

// â”€â”€â”€ POST /api/gmail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Action-based dispatcher:
//   action: "callback" â€” exchange auth code for tokens
//   action: "sync"     â€” sync last 30 days of emails + detect
//   action: "detect"   â€” re-run detection on stored emails

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    switch (action) {
      // â”€â”€ OAuth callback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "callback": {
        const { code } = body;
        if (!code) {
          return NextResponse.json(
            { error: "Missing authorization code" },
            { status: 400 }
          );
        }

        const tokens = await handleGmailCallback(code, req.nextUrl.origin);

        const { error: upsertError } = await supabase
          .from("integrations")
          .upsert(
            {
              user_id: user.id,
              provider: "gmail",
              connected: true,
              token_data: tokens,
            },
            { onConflict: "user_id,provider" }
          );

        if (upsertError) {
          return NextResponse.json(
            { error: `Failed to store tokens: ${upsertError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({ ok: true });
      }

      // â”€â”€ Email sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "sync": {
        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "gmail")
          .maybeSingle();

        if (!integration?.connected || !integration?.token_data) {
          return NextResponse.json(
            {
              error:
                "Gmail not connected. Connect Gmail first via the settings page.",
            },
            { status: 400 }
          );
        }

        const tokenData = integration.token_data as {
          accessToken: string;
          refreshToken: string | null;
        };

        const emails = await syncEmails(
          tokenData.accessToken,
          tokenData.refreshToken,
          user.id
        );

        if (emails.length === 0) {
          return NextResponse.json({
            synced: 0,
            invoicesFound: 0,
            leadsFound: 0,
          });
        }

        // Persist to the emails table
        await insertEmails(supabase, user.id, emails);

        // Run detection
        const invoices = detectInvoices(emails);
        const leads = detectLeads(emails);

        // Write detection flags back to the database
        const updates: Array<{
          gmail_id: string;
          is_invoice?: boolean;
          is_lead?: boolean;
          score?: number;
        }> = [];

        for (const inv of invoices) {
          updates.push({ gmail_id: inv.gmail_id, is_invoice: true });
        }
        for (const lead of leads) {
          updates.push({
            gmail_id: lead.gmail_id,
            is_lead: true,
            score: lead.score,
          });
        }

        if (updates.length > 0) {
          await updateEmailDetection(supabase, user.id, updates);
        }

        return NextResponse.json({
          synced: emails.length,
          invoicesFound: invoices.length,
          leadsFound: leads.length,
        });
      }

      // â”€â”€ Detection-only (re-run on stored emails) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      case "detect": {
        const stored = await getStoredEmails(supabase, user.id, {
          limit: 200,
        });

        if (stored.length === 0) {
          return NextResponse.json(
            { error: "No stored emails found. Run sync first." },
            { status: 400 }
          );
        }

        const invoices = detectInvoices(stored);
        const leads = detectLeads(stored);

        const updates: Array<{
          gmail_id: string;
          is_invoice?: boolean;
          is_lead?: boolean;
          score?: number;
        }> = [];

        for (const inv of invoices) {
          updates.push({ gmail_id: inv.gmail_id, is_invoice: true });
        }
        for (const lead of leads) {
          updates.push({
            gmail_id: lead.gmail_id,
            is_lead: true,
            score: lead.score,
          });
        }

        if (updates.length > 0) {
          await updateEmailDetection(supabase, user.id, updates);
        }

        return NextResponse.json({
          invoicesFound: invoices.length,
          leadsFound: leads.length,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[Gmail API]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
