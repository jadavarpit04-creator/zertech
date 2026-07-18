import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import * as handlers from "@/lib/api-handlers";
import { generateDraft as aiDraft } from "@/lib/ai-service";

// Map of function name -> handler
const handlerMap: Record<
  string,
  (supabase: any, userId: string, body?: any) => Promise<any>
> = {
  listInvoices: (s) => handlers.listInvoices(s),
  importInvoices: (s, u, b) => handlers.importInvoices(s, u, b),
  runInvoiceScan: (s, u) => handlers.runInvoiceScan(s, u),
  listLeads: (s) => handlers.listLeads(s),
  importLeads: (s, u, b) => handlers.importLeads(s, u, b),
  listPendingDrafts: (s) => handlers.listPendingDrafts(s),
  updateDraft: (s, u, b) => handlers.updateDraft(s, u, b),
  sendDraft: (s, u, b) => handlers.sendDraft(s, u, b),
  discardDraft: (s, u, b) => handlers.discardDraft(s, u, b),
  listActivity: (s) => handlers.listActivity(s),
  dashboardSummary: (s) => handlers.dashboardSummary(s),
  listSettings: (s) => handlers.listSettings(s),
  updateWorkflow: (s, u, b) => handlers.updateWorkflow(s, u, b),
  toggleIntegration: (s, u, b) => handlers.toggleIntegration(s, u, b),
  getEscalationSequence: (s, u, b) => handlers.getEscalationSequence(s, u, b),
  exportData: (s, u, b) => handlers.exportData(s, u, b),
  bulkApprove: (s, u, b) => handlers.bulkApprove(s, u, b),
  scheduleDraft: (s, u, b) => handlers.scheduleDraft(s, u, b),
  saveIntegrationMeta: (s, u, b) => handlers.saveIntegrationMeta(s, u, b),
  reportsSummary: (s, u, b) => handlers.reportsSummary(s, u, b),
  listTemplates: (s, u, b) => handlers.listTemplates(s, u),
  listArchivedDrafts: (s, u, b) => handlers.listArchivedDrafts(s),
  listScheduledDrafts: (s, u, b) => handlers.listScheduledDrafts(s),
  saveTemplate: (s, u, b) => handlers.saveTemplate(s, u, b),
  getProfile: (s, u, b) => handlers.getProfile(s, u),
  updateProfile: (s, u, b) => handlers.updateProfile(s, u, b),
  setPlan: (s, u, b) => handlers.setPlan(s, u, b),
};
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

    const { fn, data } = await req.json();
    const handler = handlerMap[fn];
    if (!handler) {
      return NextResponse.json({ error: `Unknown function: ${fn}` }, { status: 400 });
    }

    const result = await handler(supabase, session.user.id, data);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API fn]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
