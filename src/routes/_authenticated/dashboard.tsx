import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { dashboardSummary, runInvoiceScan } from "@/lib/followup.functions";
import { PageHeader, EmptyState } from "@/components/app-shell";

const summaryOptions = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => dashboardSummary(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(summaryOptions),
  component: DashboardPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-8">
      <div className="mono-caps text-muted-foreground">Error</div>
      <h1 className="mt-2 font-mono text-xl">Couldn't load dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="mt-4 rounded-sm border border-border px-3 py-1.5 text-sm">Retry</button>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function DashboardPage() {
  const { data } = useSuspenseQuery(summaryOptions);
  const router = useRouter();
  const queryClient = useQueryClient();
  const scan = useServerFn(runInvoiceScan);
  const mut = useMutation({
    mutationFn: () => scan(),
    onSuccess: (r) => {
      toast.success(`Scanned. ${r.created} new draft${r.created === 1 ? "" : "s"}.`);
      queryClient.invalidateQueries();
      router.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const stats = [
    { label: "Pending approvals", value: data.pending, to: "/approvals" },
    { label: "Overdue invoices", value: data.overdue, to: "/invoices" },
    { label: "New leads", value: data.newLeads, to: "/leads" },
    { label: "Messages sent", value: data.sent, to: "/history" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        actions={
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {mut.isPending ? "Scanning…" : "Run invoice scan"}
          </button>
        }
      />
      <div className="space-y-6 p-6 md:p-10">
        <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Link to={s.to} className="block bg-card p-6 transition hover:bg-accent">
                <div className="mono-caps text-muted-foreground">{s.label}</div>
                <div className="mt-3 font-mono text-4xl font-bold tracking-tight">{s.value}</div>
              </Link>
            </motion.div>
          ))}
        </div>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-mono text-lg font-semibold">Recent activity</h2>
            <Link to="/history" className="text-xs text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <EmptyState
              title="No activity yet"
              hint="Import invoices or leads to get started."
              action={
                <Link to="/invoices" className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                  Import invoices
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-sm border border-border bg-card">
              {data.recent.map((a) => (
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
