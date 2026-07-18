import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
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

// ─── GET /api/gmail ───────────────────────────────────────────
// Returns the Google OAuth consent URL. The frontend redirects the
// user to this URL to begin the Gmail connection flow.

export async function GET() {
  try {
    const url = initGmailOAuth();
    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("[Gmail GET]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

// ─── POST /api/gmail ──────────────────────────────────────────
// Action-based dispatcher:
//   action: "callback" — exchange auth code for tokens
//   action: "sync"     — sync last 30 days of emails + detect
//   action: "detect"   — re-run detection on stored emails

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    switch (action) {
      // ── OAuth callback ───────────────────────────────────────
      // Exchange the auth code Google sent back for access + refresh tokens.
      // Stores the tokens in the `integrations` table and sets connected=true.
      case "callback": {
        const { code } = body;
        if (!code) {
          return NextResponse.json(
            { error: "Missing authorization code" },
            { status: 400 }
          );
        }

        const tokens = await handleGmailCallback(code);

        const { error: upsertError } = await supabase
          .from("integrations")
          .upsert(
            {
              user_id: session.user.id,
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

      // ── Email sync ───────────────────────────────────────────
      // Fetches the last 30 days of emails via Gmail API, persists
      // them in the `emails` table, then runs invoice + lead detection.
      case "sync": {
        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("user_id", session.user.id)
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
          session.user.id
        );

        if (emails.length === 0) {
          return NextResponse.json({
            synced: 0,
            invoicesFound: 0,
            leadsFound: 0,
          });
        }

        // Persist to the emails table
        await insertEmails(supabase, session.user.id, emails);

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
          await updateEmailDetection(supabase, session.user.id, updates);
        }

        return NextResponse.json({
          synced: emails.length,
          invoicesFound: invoices.length,
          leadsFound: leads.length,
        });
      }

      // ── Detection-only (re-run on stored emails) ─────────────
      // Re-runs invoice/lead detection on previously synced emails
      // without fetching new data from Gmail.
      case "detect": {
        const stored = await getStoredEmails(supabase, session.user.id, {
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
          await updateEmailDetection(supabase, session.user.id, updates);
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
    console.error("[Gmail API]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
