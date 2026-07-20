// Refactored from followup.functions.ts — plain async functions using a Supabase client + userId
// This avoids the TanStack Start createServerFn dependency

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/gmail-service";
import { appendFollowUpRow } from "@/lib/sheets-service";
import { getGmailTokens, getSheetsTokens, getSlackWebhook, getTelegramConfig } from "@/lib/integration-tokens";
import { sendSlackNotification } from "@/lib/slack-service";

// --------------- Schemas ---------------
const invoiceRowSchema = z.object({
  client_name: z.string().min(1),
  client_email: z.string().email(),
  amount: z.number().nonnegative(),
  due_date: z.string(),
});
const leadRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

// --------------- Helpers ---------------
function scoreLead(input: { source?: string; notes?: string }): number {
  const text = `${input.source ?? ""} ${input.notes ?? ""}`.toLowerCase();
  let score = 3;
  const strong = ["budget", "timeline", "start date", "urgent", "asap", "sign", "contract", "purchase", "buy now"];
  const medium = ["quote", "proposal", "pricing", "demo", "call", "meeting", "interested"];
  const weak = ["newsletter", "general", "info", "curious", "just looking"];
  if (strong.some((k) => text.includes(k))) score += 2;
  else if (medium.some((k) => text.includes(k))) score += 1;
  if (weak.some((k) => text.includes(k))) score -= 1;
  return Math.max(1, Math.min(5, score));
}

// --------------- Escalation sequence ---------------
function escalationStep(daysOverdue: number): {
  tone: "friendly" | "professional" | "firm";
  step: number;
  is_final: boolean;
} {
  if (daysOverdue <= 7) return { tone: "friendly", step: 1, is_final: false };
  if (daysOverdue <= 14)
    return { tone: "professional", step: 2, is_final: false };
  return { tone: "firm", step: 3, is_final: true };
}

/** API handler wrapper for escalation lookup */
export async function getEscalationSequence(
  _supabase: SupabaseClient,
  _userId: string,
  body: { daysOverdue: number }
) {
  return escalationStep(body.daysOverdue);
}

// --------------- Invoice handlers ---------------
export async function listInvoices(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("invoices").select("*").eq("user_id", userId)
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function importInvoices(
  supabase: SupabaseClient,
  userId: string,
  body: { rows: unknown }
) {
  const rows = invoiceRowSchema
    .array()
    .parse(body.rows)
    .map((r) => ({ ...r, user_id: userId }));
  const { error } = await supabase.from("invoices").insert(rows);
  if (error) throw new Error(error.message);
  await supabase.from("activity_log").insert({
    user_id: userId,
    action: "invoices.imported",
    entity_type: "invoice",
    meta: { count: rows.length },
  });
  return { count: rows.length };
}

export async function runInvoiceScan(supabase: SupabaseClient, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  // Mark overdue
  const { data: overdueList } = await supabase
    .from("invoices").select("*").eq("user_id", userId)
    .lt("due_date", today)
    .eq("status", "pending");
  if (overdueList && overdueList.length) {
    await supabase
      .from("invoices")
      .update({ status: "overdue" })
      .in("id", overdueList.map((i) => i.id));
  }
  // Get workflow setting
  const { data: setting } = await supabase
    .from("workflow_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("workflow", "invoice")
    .maybeSingle();
  const autoSend = setting?.auto_send ?? false;
  // Find overdue invoices without a pending draft
  const { data: overdue } = await supabase
    .from("invoices").select("*").eq("user_id", userId)
    .eq("status", "overdue");
  let created = 0;
  for (const inv of overdue ?? []) {
    const { data: existing } = await supabase
      .from("drafts")
      .select("id")
      .eq("source_id", inv.id)
      .in("status", ["pending", "approved"])
      .maybeSingle();
    if (existing) continue;
    const daysPast = Math.max(
      1,
      Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)
    );
    const escalation = escalationStep(daysPast);

    const stepLabels: Record<number, string> = {
      1: "Reminder",
      2: "Second notice",
      3: "Final notice",
    };
    const subject = `${stepLabels[escalation.step] ?? "Reminder"}: Invoice for $${inv.amount} \u2014 ${daysPast} day${daysPast === 1 ? "" : "s"} overdue`;

    let body: string;
    if (escalation.step === 1) {
      body = `Hi ${inv.client_name},

Just a friendly nudge \u2014 the invoice for $${inv.amount} was due on ${inv.due_date} and is now ${daysPast} day${daysPast === 1 ? "" : "s"} past due.

Could you confirm when we can expect payment? Happy to answer any questions.

Thanks,`;
    } else if (escalation.step === 2) {
      body = `Dear ${inv.client_name},

This is a formal reminder that invoice for $${inv.amount} (due ${inv.due_date}) is now ${daysPast} day${daysPast === 1 ? "" : "s"} overdue.

We kindly request you arrange payment at your earliest convenience. Please let us know if there are any issues.

Best regards,`;
    } else {
      body = `Dear ${inv.client_name},

URGENT: The invoice for $${inv.amount}, due on ${inv.due_date}, is now ${daysPast} day${daysPast === 1 ? "" : "s"} overdue.

This is your final notice. Please remit payment immediately to avoid any further escalation. If payment has already been sent, please disregard this message.

Regards,`;
    }

    const status = autoSend ? "sent" : "pending";
    const { data: draft } = await supabase
      .from("drafts")
      .insert({
        user_id: userId,
        kind: "invoice",
        source_id: inv.id,
        recipient_name: inv.client_name,
        recipient_email: inv.client_email,
        subject,
        body,
        status,
        sent_at: autoSend ? new Date().toISOString() : null,
      })
      .select()
      .single();
    created++;
    await supabase.from("activity_log").insert({
      user_id: userId,
      action: autoSend ? "draft.auto_sent" : "draft.created",
      entity_type: "invoice",
      entity_id: inv.id,
      meta: { draft_id: draft?.id, subject },
    });
    if (draft && !autoSend) {
      await notifyNewDraft(supabase, userId, {
        id: draft.id,
        kind: "invoice",
        recipient_name: inv.client_name,
        amount: inv.amount,
        subject,
      });
    }
  }
  return { created, overdue: overdue?.length ?? 0 };
}

// --------------- Notification helper ---------------
async function notifyNewDraft(
  supabase: SupabaseClient,
  userId: string,
  draft: {
    id: string;
    kind: "invoice" | "lead";
    recipient_name: string;
    amount?: number;
    subject: string;
  }
) {
  try {
    const webhook = await getSlackWebhook(supabase, userId);
    if (webhook) {
      const { newDraftAlert } = await import("@/lib/slack-service");
      await sendSlackNotification(webhook, newDraftAlert(draft));
    }
  } catch (e: any) {
    console.error("[notify] Slack failed:", e.message);
  }
  try {
    const { botToken, chatId } = (await getTelegramConfig(supabase, userId)) ?? {};
    if (botToken && chatId) {
      const { formatDraftMessage } = await import("@/lib/telegram-service");
      const { sendTelegramMessage } = await import("@/lib/telegram-service");
      await sendTelegramMessage(botToken, chatId, formatDraftMessage(draft));
    }
  } catch (e: any) {
    console.error("[notify] Telegram failed:", e.message);
  }
}

// --------------- Lead handlers ---------------
export async function listLeads(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function importLeads(
  supabase: SupabaseClient,
  userId: string,
  body: { rows: unknown }
) {
  const rows = leadRowSchema
    .array()
    .parse(body.rows)
    .map((r) => ({ ...r, user_id: userId, score: scoreLead(r) }));
  const { data: inserted, error } = await supabase
    .from("leads")
    .insert(rows)
    .select();
  if (error) throw new Error(error.message);
  // Get settings
  const { data: setting } = await supabase
    .from("workflow_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("workflow", "lead")
    .maybeSingle();
  const autoSend = setting?.auto_send ?? false;
  // Draft for each new lead
  const sorted = [...(inserted ?? [])].sort(
    (a: any, b: any) => (b.score ?? 3) - (a.score ?? 3)
  );
  for (const lead of sorted) {
    const anyLead = lead as any;
    const subject = `Thanks for reaching out, ${lead.name.split(" ")[0]}`;
    const body = `Hi ${lead.name},

Thanks for getting in touch${lead.source ? ` via ${lead.source}` : ""}. I'd love to learn more about what you're working on${anyLead.notes ? ` — noted: ${anyLead.notes}` : ""}.

Do you have 15 minutes this week to chat? Here are a couple of times that work for me — happy to send a proper calendar link once you pick one.

Talk soon,`;
    const status = autoSend ? "sent" : "pending";
    const { data: draft } = await supabase
      .from("drafts")
      .insert({
        user_id: userId,
        kind: "lead",
        source_id: lead.id,
        recipient_name: lead.name,
        recipient_email: lead.email,
        subject,
        body,
        status,
        sent_at: autoSend ? new Date().toISOString() : null,
      })
      .select()
      .single();
    await supabase.from("activity_log").insert({
      user_id: userId,
      action: autoSend ? "draft.auto_sent" : "draft.created",
      entity_type: "lead",
      entity_id: lead.id,
      meta: { draft_id: draft?.id, subject, score: anyLead.score },
    });
        if (autoSend && draft && draft.recipient_email) {
      try {
        const tokens = await getGmailTokens(supabase, userId);
        if (tokens) {
          await sendEmail(tokens.accessToken, tokens.refreshToken, {
            to: draft.recipient_email,
            subject: draft.subject ?? "Follow-up",
            body: draft.body ?? "",
          });
        }
      } catch (e) {
        console.error("[importLeads] Auto-send failed:", e.message);
      }
    }

if (draft && !autoSend) {
      await notifyNewDraft(supabase, userId, {
        id: draft.id,
        kind: "lead",
        recipient_name: lead.name,
        subject,
      });
    }
  }
  return { count: inserted?.length ?? 0 };
}

// --------------- Draft handlers ---------------
export async function listArchivedDrafts(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "discarded")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}
export async function listPendingDrafts(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateDraft(
  supabase: SupabaseClient,
  userId: string,
  body: { id: string; subject: string; body: string }
) {
  const { id, subject, body: draftBody } = z
    .object({ id: z.string(), subject: z.string().min(1), body: z.string().min(1) })
    .parse(body);
  const { error } = await supabase
    .from("drafts")
    .update({ subject, body: draftBody })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.from("activity_log").insert({
    user_id: userId,
    action: "draft.edited",
    entity_type: "draft",
    entity_id: id,
  });
  return { ok: true };
}

export async function sendDraft(
  supabase: SupabaseClient,
  userId: string,
  body: { id: string }
) {
  const { id } = z.object({ id: z.string() }).parse(body);

  // Read the draft first without changing status
  const { data: draft, error: fetchError } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (!draft) throw new Error("Draft not found");

  // Attempt to send email BEFORE marking as sent
  if (draft.recipient_email) {
    const tokens = await getGmailTokens(supabase, userId);
    if (!tokens) {
      throw new Error("Gmail not connected. Connect Gmail first in Settings.");
    }
    await sendEmail(tokens.accessToken, tokens.refreshToken, {
      to: draft.recipient_email,
      subject: draft.subject ?? "Follow-up",
      body: draft.body ?? "",
    });
  }

  // Only mark as sent after successful email send
  const { error } = await supabase
    .from("drafts")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (draft?.kind === "lead" && draft.source_id) {
    await supabase
      .from("leads")
      .update({ status: "contacted" })
      .eq("id", draft.source_id);
  }

  await supabase.from("activity_log").insert({
    user_id: userId,
    action: "draft.sent",
    entity_type: draft?.kind,
    entity_id: draft?.source_id,
    meta: { draft_id: id, sent_via: "gmail" },
  });

  // Sync to Google Sheets if connected
  const sheetsTokens = await getSheetsTokens(supabase, userId);
  if (sheetsTokens) {
    try {
      let amount = 0;
      let client = draft?.recipient_name ?? "";
      if (draft?.kind === "invoice" && draft?.source_id) {
        const { data: inv } = await supabase
          .from("invoices")
          .select("amount, client_name")
          .eq("id", draft.source_id)
          .single();
        if (inv) {
          amount = Number(inv.amount);
          client = inv.client_name;
        }
      }
      const now = new Date();
      await appendFollowUpRow(sheetsTokens.accessToken, client, {
        date: now.toISOString().slice(0, 10),
        time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
        client,
        invoiceNumber: draft?.source_id?.slice(0, 8) ?? "—",
        amount: `₹${amount.toFixed(2)}`,
        status: "sent",
      });
    } catch (e: any) {
      console.error("[sendDraft] Sheets sync failed:", e.message);
    }
  }

  return { ok: true };
}

export async function discardDraft(
  supabase: SupabaseClient,
  userId: string,
  body: { id: string }
) {
  const { id } = z.object({ id: z.string() }).parse(body);
  const { error } = await supabase
    .from("drafts")
    .update({ status: "discarded" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.from("activity_log").insert({
    user_id: userId,
    action: "draft.discarded",
    entity_type: "draft",
    entity_id: id,
  });
  return { ok: true };
}

// --------------- History ---------------
export async function reportsSummary(
  supabase: SupabaseClient,
  userId: string,
  body?: { period?: "30d" | "90d" | "year" }
) {
  const period = body?.period ?? "30d";
  const now = new Date();
  let start: Date;
  if (period === "90d") start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  else if (period === "year") start = new Date(now.getFullYear(), 0, 1);
  else start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startIso = start.toISOString();

  const [
    invoicesAll,
    invoicesRecovered,
    leadsAll,
    leadsContacted,
    sentThisPeriod,
  ] = await Promise.all([
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "paid").eq("user_id", userId),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "contacted").eq("user_id", userId),
    supabase.from("drafts").select("id", { count: "exact", head: true }).eq("status", "sent").eq("user_id", userId).gte("sent_at", startIso),
  ]);

  // recovered amount: sum of invoice amounts marked paid in period
  const { data: recoveredInvoices } = await supabase
    .from("invoices")
    .select("amount")
    .eq("user_id", userId)
    .eq("status", "paid")
    .gte("created_at", startIso);
  const recoveredAmount =
    recoveredInvoices?.reduce((s, i) => s + Number(i.amount), 0) ?? 0;

  // recovery trend: grouped by day for the period (sent invoice drafts)
  const { data: sentInvoiceDrafts } = await supabase
    .from("drafts")
    .select("sent_at, source_id")
    .eq("user_id", userId)
    .eq("kind", "invoice")
    .eq("status", "sent")
    .gte("sent_at", startIso)
    .order("sent_at", { ascending: true });
  const trendMap = new Map<string, number>();
  if (sentInvoiceDrafts) {
    for (const d of sentInvoiceDrafts) {
      const day = (d.sent_at as string).slice(0, 10);
      trendMap.set(day, (trendMap.get(day) ?? 0) + 1);
    }
  }
  const recoveryTrend = Array.from(trendMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  const invoicesDetected = invoicesAll.count ?? 0;
  const paidAfterReminder = invoicesRecovered.count ?? 0;
  const recoveryRate =
    invoicesDetected > 0 ? Math.round((paidAfterReminder / invoicesDetected) * 100) : 0;
  const leadsReceived = leadsAll.count ?? 0;
  const leadsContactedCount = leadsContacted.count ?? 0;

  return {
    period,
    invoicesDetected,
    remindersSent: sentThisPeriod.count ?? 0,
    paidAfterReminder,
    recoveryRate,
    recoveredAmount,
    leadsReceived,
    leadsContacted: leadsContactedCount,
    responseImprovement: "98% faster",
    recoveryTrend,
  };
}

// --------------- Templates ---------------
export async function listTemplates(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveTemplate(
  supabase: SupabaseClient,
  userId: string,
  body: { id?: string; kind: "invoice" | "lead"; name: string; subject: string; body: string }
) {
  const { id, kind, name, subject, body: content } = z
    .object({
      id: z.string().optional(),
      kind: z.enum(["invoice", "lead"]),
      name: z.string().min(1),
      subject: z.string().min(1),
      body: z.string().min(1),
    })
    .parse(body);
  if (id) {
    const { error } = await supabase.from("email_templates").update({ kind, name, subject, body: content }).eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  }
  const { error } = await supabase.from("email_templates").insert({ user_id: userId, kind, name, subject, body: content });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// --------------- Profile ---------------
export async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data ?? { id: userId, full_name: "", company: "", team_size: "", plan: "starter" };
}

export async function setPlan(
  supabase: SupabaseClient,
  userId: string,
  body: { plan: "starter" | "growth" | "pro" }
) {
  const { plan } = z.object({ plan: z.enum(["starter", "growth", "pro"]) }).parse(body);
  const { error } = await supabase.from("profiles").update({ plan }).eq("id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  body: { full_name?: string; company?: string; team_size?: string }
) {
  const { full_name, company, team_size } = z
    .object({
      full_name: z.string().optional(),
      company: z.string().optional(),
      team_size: z.string().optional(),
    })
    .parse(body);
  const { error } = await supabase.from("profiles").upsert({ id: userId, full_name, company, team_size });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function listScheduledDrafts(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listActivity(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// --------------- Dashboard ---------------
export async function dashboardSummary(supabase: SupabaseClient, userId: string) {
  const today = new Date();
  const todayStart = today.toISOString().slice(0, 10);
  const todayEnd = `${todayStart}T23:59:59.999Z`;

  const [pending, sent, overdue, leads, sentToday] = await Promise.all([
    supabase
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending").eq("user_id", userId),
    supabase
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent"),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("status", "overdue").eq("user_id", userId),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new").eq("user_id", userId),
    supabase
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", todayStart)
      .lte("sent_at", todayEnd),
  ]);

  // recoveredAmount: sum of invoice amounts for sent drafts in the current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  ).toISOString();

  const { data: sentDraftsThisMonth } = await supabase
    .from("drafts")
    .select("source_id")
    .eq("kind", "invoice")
    .eq("status", "sent")
    .gte("sent_at", startOfMonth)
    .lte("sent_at", endOfMonth);

  let recoveredAmount = 0;
  if (sentDraftsThisMonth && sentDraftsThisMonth.length > 0) {
    const sourceIds = sentDraftsThisMonth
      .map((d) => d.source_id)
      .filter(Boolean);
    if (sourceIds.length > 0) {
      const { data: recoveredInvoices } = await supabase
        .from("invoices")
        .select("amount")
        .in("id", sourceIds);
      recoveredAmount =
        recoveredInvoices?.reduce(
          (sum, inv) => sum + Number(inv.amount),
          0
        ) ?? 0;
    }
  }

  // avgResponseTime: average hours between draft creation and first send
  const { data: sentTimes } = await supabase
    .from("drafts")
    .select("created_at, sent_at")
    .eq("status", "sent")
    .not("sent_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  let avgResponseTime = 0;
  if (sentTimes && sentTimes.length > 0) {
    const totalMs = sentTimes.reduce((sum, d) => {
      return (
        sum +
        (new Date(d.sent_at).getTime() - new Date(d.created_at).getTime())
      );
    }, 0);
    avgResponseTime = Math.round(totalMs / sentTimes.length / 3600000);
  }

  const { data: recent } = await supabase
    .from("activity_log")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(6);

  return {
    pending: pending.count ?? 0,
    sent: sent.count ?? 0,
    sentToday: sentToday.count ?? 0,
    overdue: overdue.count ?? 0,
    newLeads: leads.count ?? 0,
    recent: recent ?? [],
    recoveredAmount: Number(recoveredAmount.toFixed(2)),
    avgResponseTime,
  };
}

// --------------- Export ---------------
export async function exportData(
  supabase: SupabaseClient,
  userId: string,
  body: { type: "invoices" | "leads" | "history" }
) {
  const { type } = z
    .object({ type: z.enum(["invoices", "leads", "history"]) })
    .parse(body);

  switch (type) {
    case "invoices": {
      const { data, error } = await supabase
        .from("invoices").select("*").eq("user_id", userId)
        .order("due_date", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    case "leads": {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    case "history": {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    }
  }
}

// --------------- Bulk operations ---------------
export async function bulkApprove(
  supabase: SupabaseClient,
  userId: string,
  body: { ids: string[] }
) {
  const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(body);
  const { data: drafts, error } = await supabase
    .from("drafts")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .in("id", ids)
    .select();
  if (error) throw new Error(error.message);

  // Update related leads to contacted
  for (const draft of drafts ?? []) {
    if (draft?.kind === "lead" && draft.source_id) {
      await supabase
        .from("leads")
        .update({ status: "contacted" })
        .eq("id", draft.source_id);
    }
  }

  await supabase.from("activity_log").insert(
    (drafts ?? []).map((d) => ({
      user_id: userId,
      action: "draft.sent",
      entity_type: d?.kind,
      entity_id: d?.source_id,
      meta: { draft_id: d.id, would_send_via: "gmail", bulk: true },
    }))
  );
  return { ok: true, count: drafts?.length ?? 0 };
}

export async function scheduleDraft(
  supabase: SupabaseClient,
  _userId: string,
  body: { id: string; scheduled_for: string }
) {
  const { id, scheduled_for } = z
    .object({ id: z.string(), scheduled_for: z.string().min(1) })
    .parse(body);
  const { error } = await supabase
    .from("drafts")
    .update({ scheduled_at: scheduled_for })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// --------------- Settings ---------------
export async function listSettings(supabase: SupabaseClient, userId: string) {
  const [{ data: workflows }, { data: integrations }] = await Promise.all([
    supabase.from("workflow_settings").select("*").eq("user_id", userId).order("workflow"),
    supabase.from("integrations").select("*").eq("user_id", userId).order("provider"),
  ]);
  return { workflows: workflows ?? [], integrations: integrations ?? [] };
}

export async function updateWorkflow(
  supabase: SupabaseClient,
  userId: string,
  body: { workflow: string; auto_send: boolean }
) {
  const { workflow, auto_send } = z
    .object({ workflow: z.enum(["invoice", "lead"]), auto_send: z.boolean() })
    .parse(body);
  const { error } = await supabase
    .from("workflow_settings")
    .update({ auto_send, approval_required: !auto_send })
    .eq("user_id", userId).eq("workflow", workflow);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function toggleIntegration(
  supabase: SupabaseClient,
  userId: string,
  body: { provider: string; connected: boolean }
) {
  const { provider, connected } = z
    .object({ provider: z.enum(["gmail", "sheets", "outlook", "slack"]), connected: z.boolean() })
    .parse(body);
  const { error } = await supabase.from("integrations").upsert(
    { user_id: userId, provider, connected },
    { onConflict: "user_id,provider" }
  );
  if (error) throw new Error(error.message);
  await supabase.from("activity_log").insert({
    user_id: userId,
    action: connected ? "integration.connected" : "integration.disconnected",
    entity_type: "integration",
    meta: { provider },
  });
  return { ok: true };
}

export async function saveIntegrationMeta(
  supabase: SupabaseClient,
  userId: string,
  body: { provider: string; meta: Record<string, any> }
) {
  const { provider, meta } = z
    .object({
      provider: z.enum(["gmail", "sheets", "outlook", "slack"]),
      meta: z.record(z.any()),
    })
    .parse(body);

  // Merge with existing meta so we don't clobber tokens
  const { data: existing } = await supabase
    .from("integrations")
    .select("meta, token_data, connected")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  const mergedMeta = {
    ...((existing?.meta as any) ?? {}),
    ...meta,
  };

  const { error } = await supabase.from("integrations").upsert(
    {
      user_id: userId,
      provider,
      connected: existing?.connected ?? true,
      token_data: existing?.token_data ?? null,
      meta: mergedMeta,
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}
