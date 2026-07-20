import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import * as handlers from "@/lib/api-handlers";

// Map of function name -> handler
// All accept (supabase, userId, body?) and return a value
const handlerMap: Record<
  string,
  (supabase: any, userId: string, body?: any) => Promise<any>
> = {
  listInvoices: (s, u) => handlers.listInvoices(s, u),
  importInvoices: (s, u, b) => handlers.importInvoices(s, u, b),
  runInvoiceScan: (s, u) => handlers.runInvoiceScan(s, u),
  listLeads: (s, u) => handlers.listLeads(s, u),
  importLeads: (s, u, b) => handlers.importLeads(s, u, b),
  listPendingDrafts: (s, u) => handlers.listPendingDrafts(s, u),
  updateDraft: (s, u, b) => handlers.updateDraft(s, u, b),
  sendDraft: (s, u, b) => handlers.sendDraft(s, u, b),
  discardDraft: (s, u, b) => handlers.discardDraft(s, u, b),
  listActivity: (s, u) => handlers.listActivity(s, u),
  dashboardSummary: (s, u) => handlers.dashboardSummary(s, u),
  listSettings: (s, u) => handlers.listSettings(s, u),
  updateWorkflow: (s, u, b) => handlers.updateWorkflow(s, u, b),
  toggleIntegration: (s, u, b) => handlers.toggleIntegration(s, u, b),
  getEscalationSequence: (s, u, b) => handlers.getEscalationSequence(s, u, b),
  exportData: (s, u, b) => handlers.exportData(s, u, b),
  bulkApprove: (s, u, b) => handlers.bulkApprove(s, u, b),
  scheduleDraft: (s, u, b) => handlers.scheduleDraft(s, u, b),
  saveIntegrationMeta: (s, u, b) => handlers.saveIntegrationMeta(s, u, b),
  reportsSummary: (s, u, b) => handlers.reportsSummary(s, u, b),
  listTemplates: (s, u, b) => handlers.listTemplates(s, u),
  listArchivedDrafts: (s, u, b) => handlers.listArchivedDrafts(s, u),
  listScheduledDrafts: (s, u, b) => handlers.listScheduledDrafts(s, u),
  saveTemplate: (s, u, b) => handlers.saveTemplate(s, u, b),
  getProfile: (s, u, b) => handlers.getProfile(s, u),
  updateProfile: (s, u, b) => handlers.updateProfile(s, u, b),
  setPlan: (s, u, b) => handlers.setPlan(s, u, b),
};

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req.headers);

    const { fn, data } = await req.json();
    const handler = handlerMap[fn];
    if (!handler) {
      return NextResponse.json({ error: `Unknown function: ${fn}` }, { status: 400 });
    }

    const result = await handler(supabase, user.id, data);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[API fn]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
