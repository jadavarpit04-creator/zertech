// Email store — Supabase-backed persistence for synced Gmail emails.
// Expects a table `emails` with the following schema:
//   id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
//   user_id       uuid NOT NULL REFERENCES auth.users(id)
//   gmail_id      text NOT NULL
//   from          text NOT NULL DEFAULT ''
//   subject       text NOT NULL DEFAULT ''
//   body_snippet  text NOT NULL DEFAULT ''
//   has_attachments boolean NOT NULL DEFAULT false
//   received_at   timestamptz NOT NULL DEFAULT now()
//   is_invoice    boolean NOT NULL DEFAULT false
//   is_lead       boolean NOT NULL DEFAULT false
//   score         int NOT NULL DEFAULT 0
//   UNIQUE (user_id, gmail_id)

import type { SupabaseClient } from "@supabase/supabase-js";

export interface EmailRecord {
  id?: string;
  user_id: string;
  gmail_id: string;
  from: string;
  subject: string;
  body_snippet: string;
  has_attachments: boolean;
  received_at: string;
  is_invoice?: boolean;
  is_lead?: boolean;
  score?: number;
}

// ─── Insert / upsert ───────────────────────────────────────────

/**
 * Insert or update emails in the `emails` table.
 * Uses upsert on (user_id, gmail_id) conflict to avoid duplicates.
 * Returns the stored records.
 */
export async function insertEmails(
  supabase: SupabaseClient,
  userId: string,
  emails: Array<{
    gmail_id: string;
    from: string;
    subject: string;
    body_snippet: string;
    has_attachments: boolean;
    received_at: string;
  }>
): Promise<EmailRecord[]> {
  const rows = emails.map((e) => ({
    user_id: userId,
    gmail_id: e.gmail_id,
    sender: e.from,
    subject: e.subject,
    body_snippet: e.body_snippet,
    has_attachments: e.has_attachments,
    received_at: e.received_at,
    is_invoice: false,
    is_lead: false,
    score: 0,
  }));

  const { data, error } = await supabase
    .from("emails")
    .upsert(rows, { onConflict: "user_id,gmail_id" })
    .select();

  if (error) {
    throw new Error(`Failed to store emails: ${error.message}`);
  }

  return (data ?? []) as EmailRecord[];
}

// ─── Query ─────────────────────────────────────────────────────

/**
 * Fetch stored emails for a user with optional filtering.
 * Results are sorted by received_at descending (newest first).
 */
export async function getStoredEmails(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    isInvoice?: boolean;
    isLead?: boolean;
    limit?: number;
  }
): Promise<EmailRecord[]> {
  let query = supabase
    .from("emails")
    .select("*")
    .eq("user_id", userId)
    .order("received_at", { ascending: false });

  if (options?.isInvoice !== undefined) {
    query = query.eq("is_invoice", options.isInvoice);
  }
  if (options?.isLead !== undefined) {
    query = query.eq("is_lead", options.isLead);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch emails: ${error.message}`);
  }

  return (data ?? []) as EmailRecord[];
}

// ─── Update detection flags ───────────────────────────────────

/**
 * Update the invoice/lead detection flags and score on stored emails.
 * Each update targets a specific gmail_id for the given user.
 */
export async function updateEmailDetection(
  supabase: SupabaseClient,
  userId: string,
  updates: Array<{
    gmail_id: string;
    is_invoice?: boolean;
    is_lead?: boolean;
    score?: number;
  }>
): Promise<void> {
  for (const u of updates) {
    const payload: Record<string, unknown> = {};
    if (u.is_invoice !== undefined) payload.is_invoice = u.is_invoice;
    if (u.is_lead !== undefined) payload.is_lead = u.is_lead;
    if (u.score !== undefined) payload.score = u.score;

    if (Object.keys(payload).length === 0) continue;

    const { error } = await supabase
      .from("emails")
      .update(payload)
      .eq("user_id", userId)
      .eq("gmail_id", u.gmail_id);

    if (error) {
      throw new Error(
        `Failed to update email detection for ${u.gmail_id}: ${error.message}`
      );
    }
  }
}

// ─── Delete ────────────────────────────────────────────────────

/**
 * Delete emails for a user, optionally scoped to specific gmail_ids.
 * If no gmail_ids are provided, all emails for the user are deleted.
 */
export async function deleteEmails(
  supabase: SupabaseClient,
  userId: string,
  gmailIds?: string[]
): Promise<void> {
  let query = supabase.from("emails").delete().eq("user_id", userId);
  if (gmailIds && gmailIds.length > 0) {
    query = query.in("gmail_id", gmailIds);
  }
  const { error } = await query;
  if (error) {
    throw new Error(`Failed to delete emails: ${error.message}`);
  }
}
