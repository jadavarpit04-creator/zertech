import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listActivity } from "@/lib/followup.functions";
import { PageHeader, EmptyState } from "@/components/app-shell";

const opts = queryOptions({ queryKey: ["activity"], queryFn: () => listActivity() });

export const Route = createFileRoute("/_authenticated/history")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: HistoryPage,
  errorComponent: ({ error }) => <div className="p-8 text-sm">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function HistoryPage() {
  const { data } = useSuspenseQuery(opts);
  return (
    <>
      <PageHeader eyebrow="Log" title="History" />
      <div className="p-6 md:p-10">
        {data.length === 0 ? (
          <EmptyState title="No activity" hint="Actions you take will appear here." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-sm border border-border bg-card">
            {data.map((a) => (
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
