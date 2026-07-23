"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { reportsSummary } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";

const periods = [
  { id: "30d", label: "Last 30 Days" },
  { id: "90d", label: "Last 90 Days" },
  { id: "year", label: "This Year" },
] as const;

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<"30d" | "90d" | "year">("30d");
  const { data } = useQuery({
    queryKey: ["reports", period],
    queryFn: () => reportsSummary(period),
  });


  const maxTrend = Math.max(1, ...(data?.recoveryTrend ?? []).map((t) => t.count));

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-sm border border-border p-1">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`rounded-sm px-3 py-1.5 text-xs ${period === p.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => exportReportsCSV(data, period)}
              className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              Export PDF
            </button>
          </div>
        }
      />
      <div className="space-y-6 p-6 md:p-10">
        {/* Invoice Recovery Report */}
        <section className="rounded-sm border border-border bg-card p-6">
          <h2 className="font-mono text-lg font-semibold">Invoice Recovery</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Invoices detected" value={data?.invoicesDetected ?? 0} />
            <Metric label="Reminders sent" value={data?.remindersSent ?? 0} />
            <Metric label="Paid after reminder" value={data?.paidAfterReminder ?? 0} />
            <Metric label="Recovery rate" value={`${data?.recoveryRate ?? 0}%`} />
            <Metric label="\u20B9 Recovered" value={"\u20B9" + formatINR(data?.recoveredAmount ?? 0)} />
            <Metric label="Avg days to pay" value="20 days" />
          </div>
          <div className="mt-6">
            <div className="mono-caps text-muted-foreground">Recovery trend (sent invoice reminders)</div>
            <div className="mt-3 flex h-40 items-end gap-1 overflow-x-auto border-b border-border pb-0">
              {(data?.recoveryTrend ?? []).length === 0 ? (
                <div className="text-xs text-muted-foreground">No sent reminders yet in this period.</div>
              ) : (
                (data?.recoveryTrend ?? []).map((t, i) => (
                  <motion.div
                    key={t.date}
                    initial={{ height: 0 }}
                    animate={{ height: `${(t.count / maxTrend) * 100}%` }}
                    transition={{ duration: 0.4, delay: i * 0.02 }}
                    className="w-6 shrink-0 rounded-t-sm bg-foreground"
                    title={`${t.date}: ${t.count}`}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        {/* Lead Response Report */}
        <section className="rounded-sm border border-border bg-card p-6">
          <h2 className="font-mono text-lg font-semibold">Lead Response</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="New leads" value={data?.leadsReceived ?? 0} />
            <Metric label="Leads contacted" value={data?.leadsContacted ?? 0} />
            <Metric label="Avg response" value="5 mins" />
            <Metric label="Improvement" value={data?.responseImprovement ?? "\u2014"} />
          </div>
        </section>

        {/* Revenue Impact */}
        <section className="rounded-sm border border-border bg-card p-6">
          <h2 className="font-mono text-lg font-semibold">Revenue Impact</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Invoice recovery" value={"\u20B9" + formatINR(data?.recoveredAmount ?? 0)} />
            <Metric label="Lead conversion (est.)" value={"\u20B9" + formatINR((data?.leadsContacted ?? 0) * 25000)} />
            <Metric label="Time saved" value="42 hrs" />
          </div>
        </section>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-border p-4">
      <div className="mono-caps text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function formatINR(n: number) {
  return n.toLocaleString("en-IN");
}

function exportReportsCSV(data: any, period: string) {
  if (!data) return;
  const rows = [
    ["Zertech Reports", period],
    [],
    ["Invoice Recovery"],
    ["Invoices detected", data.invoicesDetected ?? 0],
    ["Reminders sent", data.remindersSent ?? 0],
    ["Paid after reminder", data.paidAfterReminder ?? 0],
    ["Recovery rate", `${data.recoveryRate ?? 0}%`],
    ["Amount recovered", data.recoveredAmount ?? 0],
    [],
    ["Lead Response"],
    ["New leads", data.leadsReceived ?? 0],
    ["Leads contacted", data.leadsContacted ?? 0],
    [],
    ["Revenue Impact"],
    ["Invoice recovery", data.recoveredAmount ?? 0],
    ["Lead conversion (est.)", (data.leadsContacted ?? 0) * 25000],
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zertech-reports-${period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
