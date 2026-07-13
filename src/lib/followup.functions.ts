import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// -------------------- Invoices --------------------
const invoiceRowSchema = z.object({
  client_name: z.string().min(1),
  client_email: z.string().email(),
  amount: z.number().nonnegative(),
  due_date: z.string(), // YYYY-MM-DD
});

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("invoices")
      .select("*")
      .order("due_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const importInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rows: unknown }) =>
    z.object({ rows: z.array(invoiceRowSchema) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const rows = data.rows.map((r) => ({ ...r, user_id: context.userId }));
    const { error } = await context.supabase.from("invoices").insert(rows);
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      user_id: context.userId,
      action: "invoices.imported",
      entity_type: "invoice",
      meta: { count: rows.length },
    });
    return { count: rows.length };
  });

export const runInvoiceScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    // Mark overdue
    const { data: overdueList } = await context.supabase
      .from("invoices")
      .select("*")
      .lt("due_date", today)
      .eq("status", "pending");

    if (overdueList && overdueList.length) {
      await context.supabase
        .from("invoices")
        .update({ status: "overdue" })
        .in("id", overdueList.map((i) => i.id));
    }

    // Get user's workflow settings
    const { data: setting } = await context.supabase
      .from("workflow_settings")
      .select("*")
      .eq("workflow", "invoice")
      .maybeSingle();
    const autoSend = setting?.auto_send ?? false;

    // Find overdue invoices without a pending draft
    const { data: overdue } = await context.supabase
      .from("invoices")
      .select("*")
      .eq("status", "overdue");

    let created = 0;
    for (const inv of overdue ?? []) {
      const { data: existing } = await context.supabase
        .from("drafts")
        .select("id")
        .eq("source_id", inv.id)
        .in("status", ["pending", "approved"])
        .maybeSingle();
      if (existing) continue;

      const daysPast = Math.max(
        1,
        Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000),
      );
      const subject = `Reminder: invoice for $${inv.amount} — ${daysPast} day${daysPast === 1 ? "" : "s"} overdue`;
      const body = `Hi ${inv.client_name},

Just a friendly nudge — the invoice for $${inv.amount} was due on ${inv.due_date} and is now ${daysPast} day${daysPast === 1 ? "" : "s"} past due.

Could you confirm when we can expect payment? Happy to answer any questions.

Thanks,`;

      const status = autoSend ? "sent" : "pending";
      const { data: draft } = await context.supabase
        .from("drafts")
        .insert({
          user_id: context.userId,
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
      await context.supabase.from("activity_log").insert({
        user_id: context.userId,
        action: autoSend ? "draft.auto_sent" : "draft.created",
        entity_type: "invoice",
        entity_id: inv.id,
        meta: { draft_id: draft?.id, subject },
      });
    }
    return { created, overdue: overdue?.length ?? 0 };
  });

// -------------------- Leads --------------------
const leadRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  source: z.string().optional(),
});

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const importLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rows: unknown }) =>
    z.object({ rows: z.array(leadRowSchema) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const rows = data.rows.map((r) => ({ ...r, user_id: context.userId }));
    const { data: inserted, error } = await context.supabase
      .from("leads")
      .insert(rows)
      .select();
    if (error) throw new Error(error.message);

    // Get settings
    const { data: setting } = await context.supabase
      .from("workflow_settings")
      .select("*")
      .eq("workflow", "lead")
      .maybeSingle();
    const autoSend = setting?.auto_send ?? false;

    // Draft for each new lead
    for (const lead of inserted ?? []) {
      const subject = `Thanks for reaching out, ${lead.name.split(" ")[0]}`;
      const body = `Hi ${lead.name},

Thanks for getting in touch${lead.source ? ` via ${lead.source}` : ""}. I'd love to learn more about what you're working on.

Do you have 15 minutes this week to chat? Here are a couple of times that work for me — happy to send a proper calendar link once you pick one.

Talk soon,`;
      const status = autoSend ? "sent" : "pending";
      const { data: draft } = await context.supabase
        .from("drafts")
        .insert({
          user_id: context.userId,
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
      await context.supabase.from("activity_log").insert({
        user_id: context.userId,
        action: autoSend ? "draft.auto_sent" : "draft.created",
        entity_type: "lead",
        entity_id: lead.id,
        meta: { draft_id: draft?.id, subject },
      });
    }

    return { count: inserted?.length ?? 0 };
  });

// -------------------- Drafts / Approvals --------------------
export const listPendingDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("drafts")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; subject: string; body: string }) =>
    z.object({ id: z.string().uuid(), subject: z.string().min(1), body: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("drafts")
      .update({ subject: data.subject, body: data.body })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      user_id: context.userId,
      action: "draft.edited",
      entity_type: "draft",
      entity_id: data.id,
    });
    return { ok: true };
  });

export const sendDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: draft, error } = await context.supabase
      .from("drafts")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Update source entity status
    if (draft?.kind === "lead" && draft.source_id) {
      await context.supabase
        .from("leads")
        .update({ status: "contacted" })
        .eq("id", draft.source_id);
    }

    await context.supabase.from("activity_log").insert({
      user_id: context.userId,
      action: "draft.sent",
      entity_type: draft?.kind,
      entity_id: draft?.source_id,
      meta: { draft_id: data.id, would_send_via: "gmail" },
    });
    return { ok: true };
  });

export const discardDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("drafts")
      .update({ status: "discarded" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      user_id: context.userId,
      action: "draft.discarded",
      entity_type: "draft",
      entity_id: data.id,
    });
    return { ok: true };
  });

// -------------------- History --------------------
export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// -------------------- Dashboard summary --------------------
export const dashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [pending, sent, overdue, leads] = await Promise.all([
      context.supabase.from("drafts").select("id", { count: "exact", head: true }).eq("status", "pending"),
      context.supabase.from("drafts").select("id", { count: "exact", head: true }).eq("status", "sent"),
      context.supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "overdue"),
      context.supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);
    const { data: recent } = await context.supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6);
    return {
      pending: pending.count ?? 0,
      sent: sent.count ?? 0,
      overdue: overdue.count ?? 0,
      newLeads: leads.count ?? 0,
      recent: recent ?? [],
    };
  });

// -------------------- Settings --------------------
export const listSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: workflows }, { data: integrations }] = await Promise.all([
      context.supabase.from("workflow_settings").select("*").order("workflow"),
      context.supabase.from("integrations").select("*").order("provider"),
    ]);
    return { workflows: workflows ?? [], integrations: integrations ?? [] };
  });

export const updateWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workflow: "invoice" | "lead"; auto_send: boolean }) =>
    z
      .object({ workflow: z.enum(["invoice", "lead"]), auto_send: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workflow_settings")
      .update({ auto_send: data.auto_send, approval_required: !data.auto_send })
      .eq("workflow", data.workflow);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider: string; connected: boolean }) =>
    z
      .object({ provider: z.enum(["gmail", "sheets", "outlook", "slack"]), connected: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("integrations").upsert(
      {
        user_id: context.userId,
        provider: data.provider,
        connected: data.connected,
      },
      { onConflict: "user_id,provider" },
    );
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      user_id: context.userId,
      action: data.connected ? "integration.connected" : "integration.disconnected",
      entity_type: "integration",
      meta: { provider: data.provider },
    });
    return { ok: true };
  });
