import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { z } from "zod";
import {
  generateDraft,
  getEscalationTone,
  type Tone,
  type InvoiceData,
  type LeadData,
} from "@/lib/ai-service";

// ------ Validation schemas ------

const toneSchema = z.enum(["friendly", "professional", "firm"]);

const invoiceDataSchema = z.object({
  client_name: z.string().min(1),
  amount: z.number().nonnegative(),
  due_date: z.string().min(1),
  days_overdue: z.number().int().nonnegative(),
  invoice_id: z.string().optional(),
});

const leadDataSchema = z.object({
  lead_name: z.string().min(1),
  source: z.string().optional(),
  notes: z.string().optional(),
});

const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("invoice"),
    tone: toneSchema.optional(),
    data: invoiceDataSchema,
  }),
  z.object({
    kind: z.literal("lead"),
    tone: toneSchema.optional(),
    data: leadDataSchema,
  }),
]);

// ------ POST handler ------

export async function POST(req: NextRequest) {
  try {
    // Authenticate via Better-Auth
    await requireAuth();

    // Parse and validate
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { kind, tone: explicitTone, data } = parsed.data;

    // Determine tone â€” if not explicitly provided, use escalation logic (invoice only)
    let tone: Tone;
    if (explicitTone) {
      tone = explicitTone;
    } else if (kind === "invoice") {
      tone = getEscalationTone((data as InvoiceData).days_overdue);
    } else {
      tone = "professional"; // default for leads
    }

    // Generate
    const result = await generateDraft(kind, tone, data);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[API ai/draft]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
