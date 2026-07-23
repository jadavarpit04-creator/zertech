"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { dashboardSummary, runInvoiceScan } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/app-shell";

export default function DashboardPage() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardSummary(),
  });
  const queryClient = useQueryClient();
  const scanMut = useMutation({
    mutationFn: () => runInvoiceScan(),
    onSuccess: (r) => {
      toast.success(`Scanned. ${r.created} new draft${r.created === 1 ? "" : "s"}.`);
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });



  const stats = [
    { label: "Pending approvals", value: data?.pending ?? 0, to: "/approvals" },
    { label: "Messages sent", value: data?.sent ?? 0, to: "/history" },
    { label: "Sent today", value: data?.sentToday ?? 0, to: "/history" },
    { label: "Overdue invoices", value: data?.overdue ?? 0, to: "/invoices" },
    { label: "New leads", value: data?.newLeads ?? 0, to: "/leads" },
    { label: "Recovered this month", value: `$${data?.recoveredAmount ?? 0}`, to: "/invoices" },
    { label: "Avg response time", value: data?.responseImprovement ?? (data?.avgResponseTime != null ? `${data.avgResponseTime}h` : "No data yet"), subtitle: data?.avgResponseTime != null ? `${data.avgResponseTime}h avg` : undefined, to: "/history" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        actions={
          <button
            onClick={() => scanMut.mutate()}
            disabled={scanMut.isPending}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {scanMut.isPending ? "Scanning…" : "Run invoice scan"}
          </button>
        }
      />
      <div className="space-y-6 p-6 md:p-10">
        <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Link href={s.to} className="block bg-card p-6 transition hover:bg-accent">
                <div className="mono-caps text-muted-foreground">{s.label}</div>
                <div className="mt-3 font-mono text-4xl font-bold tracking-tight">{s.value}</div>
                {(s as any).subtitle && (
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{(s as any).subtitle}</div>
                )}
              </Link>
            </motion.div>
          ))}
        </div>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-mono text-lg font-semibold">Recent activity</h2>
            <Link href="/history" className="text-xs text-muted-foreground hover:text-foreground">
              View all {"\u2192"}
            </Link>
          </div>
          {(data?.recent ?? []).length === 0 ? (
            <EmptyState
              title="No activity yet"
              hint="Import invoices or leads to get started."
              action={
                <Link href="/invoices" className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                  Import invoices
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-sm border border-border bg-card">
              {(data?.recent ?? []).map((a: any) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                    <div className="mt-0.5">{formatAction(a.action)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function formatAction(action: string) {
  const map: Record<string, string> = {
    "draft.created": "New draft created",
    "draft.sent": "Message sent",
    "draft.auto_sent": "Message auto-sent",
    "draft.edited": "Draft edited",
    "draft.discarded": "Draft discarded",
    "invoices.imported": "Invoices imported",
    "integration.connected": "Integration connected",
    "integration.disconnected": "Integration disconnected",
  };
  return map[action] ?? action;
}

