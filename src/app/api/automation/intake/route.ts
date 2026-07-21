import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/automation/intake
 *
 * Receives structured email/lead data extracted by AI.
 * Creates invoice/lead records + drafts for user approval.
 *
 * Body: discriminated union on `type` field ("invoice" | "lead")
 */

// --- Validation schemas ---

const invoiceIntakeSchema = z.object({
  type: z.literal("invoice"),
  client_name: z.string().min(1),
  client_email: z.string().email(),
  invoice_number: z.string().optional(),
  amount: z.number().nonnegative(),
  due_date: z.string(),
  tone_recommendation: z.enum(["friendly", "professional", "firm"]).optional(),
  draft_subject: z.string().min(1),
  draft_body: z.string().min(1),
  source_email_id: z.string().optional(),
  user_id: z.string().optional(),
});

const leadIntakeSchema = z.object({
  type: z.literal("lead"),
  lead_name: z.string().min(1),
  email: z.string().email(),
  company_name: z.string().optional(),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  score: z.number().int().min(1).max(5).optional(),
  draft_subject: z.string().min(1),
  draft_body: z.string().min(1),
  source_email_id: z.string().optional(),
  user_id: z.string().optional(),
});

const intakeSchema = z.discriminatedUnion("type", [
  invoiceIntakeSchema,
  leadIntakeSchema,
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Validate payload
    const parsed = intakeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const userId = data.user_id || "system";
    const supabase = supabaseAdmin;

    if (data.type === "invoice") {
      // 3a. Insert invoice record
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          user_id: userId,
          client_name: data.client_name,
          client_email: data.client_email,
          invoice_number: data.invoice_number ?? null,
          amount: data.amount,
          due_date: data.due_date,
          status: "pending",
          meta: {
            source_email_id: data.source_email_id,
            tone: data.tone_recommendation,
            source: "intake",
          },
        })
        .select()
        .single();
      if (invErr) throw new Error(invErr.message);

      // 3b. Create draft for user review
      const { data: draft, error: draftErr } = await supabase
        .from("drafts")
        .insert({
          user_id: userId,
          kind: "invoice",
          source_id: invoice.id,
          recipient_name: data.client_name,
          recipient_email: data.client_email,
          subject: data.draft_subject,
          body: data.draft_body,
          status: "pending",
        })
        .select()
        .single();
      if (draftErr) throw new Error(draftErr.message);

      // 3c. Log activity
      await supabase.from("activity_log").insert({
        user_id: userId,
        action: "automation.intake_invoice",
        entity_type: "invoice",
        entity_id: invoice.id,
        meta: { draft_id: draft.id, source: "intake" },
      });

      return NextResponse.json({
        ok: true,
        type: "invoice",
        invoice_id: invoice.id,
        draft_id: draft.id,
      });
    } else {
      // 4a. Insert lead record
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          user_id: userId,
          name: data.lead_name,
          email: data.email,
          source: data.company_name ?? "Intake",
          notes: [data.budget, data.timeline].filter(Boolean).join("; ") || null,
          score: data.score ?? 3,
          status: "new",
        })
        .select()
        .single();
      if (leadErr) throw new Error(leadErr.message);

      // 4b. Create draft for user review
      const { data: draft, error: draftErr } = await supabase
        .from("drafts")
        .insert({
          user_id: userId,
          kind: "lead",
          source_id: lead.id,
          recipient_name: data.lead_name,
          recipient_email: data.email,
          subject: data.draft_subject,
          body: data.draft_body,
          status: "pending",
        })
        .select()
        .single();
      if (draftErr) throw new Error(draftErr.message);

      // 4c. Log activity
      await supabase.from("activity_log").insert({
        user_id: userId,
        action: "automation.intake_lead",
        entity_type: "lead",
        entity_id: lead.id,
        meta: { draft_id: draft.id, source: "intake" },
      });

      return NextResponse.json({
        ok: true,
        type: "lead",
        lead_id: lead.id,
        draft_id: draft.id,
      });
    }
  } catch (err: any) {
    console.error("[Intake]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
