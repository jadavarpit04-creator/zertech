"use client";

import { useQuery } from "@tanstack/react-query";
import { listActivity } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/app-shell";
import ExportButton from "@/app/(authenticated)/invoices/export-button";

export default function HistoryPage() {
  const { data } = useQuery({
    queryKey: ["activity"],
    queryFn: () => listActivity(),
  });



  return (
    <>
      <PageHeader eyebrow="Log" title="History" actions={<ExportButton type="history" />} />
      <div className="p-6 md:p-10">
        {!data || data.length === 0 ? (
          <EmptyState title="No activity" hint="Actions you take will appear here." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-sm border border-border bg-card">
            {data.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-mono">{formatAction(a.action, a.meta)}</div>
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function formatAction(action: string, meta?: any): string {
  const map: Record<string, (m: any) => string> = {
    "draft.created": () => "Draft created",
    "draft.sent": () => "Message sent",
    "draft.auto_sent": () => "Message auto-sent",
    "draft.edited": () => "Draft edited",
    "draft.discarded": () => "Draft discarded",
    "draft.approved": () => "Draft approved",
    "invoices.imported": () => "Invoices imported",
    "integration.connected": (m) => m?.provider ? `Connected ${m.provider}` : "Integration connected",
    "integration.disconnected": (m) => m?.provider ? `Disconnected ${m.provider}` : "Integration disconnected",
    "invoice.reminder_sent": () => "Invoice reminder sent",
    "lead.followup_sent": () => "Lead follow-up sent",
    "draft.created_invoice": () => "Invoice draft created",
    "draft.created_lead": () => "Lead draft created",
  };
  return map[action]?.(meta) ?? action;
}
