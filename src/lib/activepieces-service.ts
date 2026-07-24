/**
 * activepieces-service.ts
 *
 * Backend se ActivePieces webhooks ko call karne ke liye dispatch functions.
 * Har function ek specific flow trigger karta hai ActivePieces me.
 *
 * Webhook URLs .env me define hain:
 *   AP_WEBHOOK_INVOICE_DRAFT=https://cloud.activepieces.com/api/v1/webhooks/xxx
 *   AP_WEBHOOK_LEAD_DRAFT=https://cloud.activepieces.com/api/v1/webhooks/yyy
 *   AP_WEBHOOK_SEND_CONFIRM=https://cloud.activepieces.com/api/v1/webhooks/zzz
 *   AP_WEBHOOK_SECRET=shared_secret
 */

const AP_SECRET = process.env.AP_WEBHOOK_SECRET || "";
const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080";

async function callWebhook(url: string, payload: unknown): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": AP_SECRET,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.error("[activepieces] webhook call failed:", e);
    return false;
  }
}

// ─── Flow 1: Invoice Draft Creation ───────────────────────────
// Backend detect kare → ActivePieces ko batao → AI draft banaye → save kare
export async function triggerInvoiceDraftCreation(items: Array<{
  user_id: string;
  gmail_access_token: string;
  client_name: string;
  client_email: string;
  invoice_number?: string;
  amount: number;
  due_date: string;
  tone?: string;
  gmail_id?: string;
}>) {
  // Send all items in a batch (needed for ActivePieces Loop on Items)
  return callWebhook(
    process.env.AP_WEBHOOK_INVOICE_DRAFT || "",
    { items }
  );
}

// ─── Flow 2: Lead Draft Creation ─────────────────────────────
export async function triggerLeadDraftCreation(items: Array<{
  user_id: string;
  gmail_access_token: string;
  lead_name: string;
  email: string;
  inquiry_text: string;
  tone?: string;
  score?: number;
}>) {
  return callWebhook(
    process.env.AP_WEBHOOK_LEAD_DRAFT || "",
    { items }
  );
}

// ─── Flow 3/6: Send After Approval ──────────────────────────
// User "Approve" click kare → backend ActivePieces ko batao → actual send
export async function triggerSendAfterApproval(data: {
  draft_id: string;
  user_id: string;
  gmail_access_token: string;
  recipient_email: string;
  subject: string;
  body: string;
  related_type: "invoice" | "lead";
  related_id: string;
  scheduled_for?: string | null;
}) {
  return callWebhook(
    process.env.AP_WEBHOOK_SEND_CONFIRM || "",
    data
  );
}

// ─── Backend Receiving Endpoints (yeh ActivePieces call karega) ──
// Ye functions nahi hain — ye API routes hain jo ActivePieces se call hote hain.
// Check karo: /api/drafts/create, /api/invoices/:id/mark-sent, etc.

export { BASE };
