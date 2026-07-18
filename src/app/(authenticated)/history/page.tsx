"use client";

import { useQuery } from "@tanstack/react-query";
import { listActivity } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/app-shell";
import ExportButton from "@/app/(authenticated)/invoices/export-button";

export default function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: () => listActivity(),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading history…</div>;

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
                  <div className="font-mono">{a.action}</div>
                  {a.meta && Object.keys(a.meta as object).length > 0 && (
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {JSON.stringify(a.meta)}
                    </div>
                  )}
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
