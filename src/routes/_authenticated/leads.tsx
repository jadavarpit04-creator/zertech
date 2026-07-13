import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listLeads, importLeads } from "@/lib/followup.functions";
import { PageHeader, EmptyState } from "@/components/app-shell";

const opts = queryOptions({ queryKey: ["leads"], queryFn: () => listLeads() });

export const Route = createFileRoute("/_authenticated/leads")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: LeadsPage,
  errorComponent: ({ error }) => <div className="p-8 text-sm">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function LeadsPage() {
  const { data } = useSuspenseQuery(opts);
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Workflow"
        title="Leads"
        actions={
          <button
            onClick={() => setOpen(true)}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Import leads
          </button>
        }
      />
      <div className="p-6 md:p-10">
        {data.length === 0 ? (
          <EmptyState
            title="No leads yet"
            hint="Import leads to auto-draft follow-up messages."
            action={
              <button
                onClick={() => setOpen(true)}
                className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Import leads
              </button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-sm border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left">
                  <th className="mono-caps px-4 py-3 text-muted-foreground">Score</th>
                  <th className="mono-caps px-4 py-3 text-muted-foreground">Name</th>
                  <th className="mono-caps px-4 py-3 text-muted-foreground">Email</th>
                  <th className="mono-caps px-4 py-3 text-muted-foreground">Source</th>
                  <th className="mono-caps px-4 py-3 text-muted-foreground">Notes</th>
                  <th className="mono-caps px-4 py-3 text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((l: any) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3"><ScoreBadge score={l.score ?? 3} /></td>
                    <td className="px-4 py-3">{l.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.source ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{l.notes ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="mono-caps rounded-sm bg-muted px-2 py-1 text-muted-foreground">
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        )}
      </div>
      {open && <ImportModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 4
      ? "bg-foreground text-background"
      : score <= 2
      ? "bg-muted text-muted-foreground"
      : "bg-muted text-foreground";
  return (
    <span className={`mono-caps inline-flex items-center gap-1 rounded-sm px-2 py-1 ${tone}`}>
      <span className="font-bold">{score}</span>
      <span>/5</span>
    </span>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const importFn = useServerFn(importLeads);
  const [text, setText] = useState(
    "Jane Doe, jane@startup.io, Website, budget confirmed, needs to start next month\nMike Ross, mike@corp.com, Referral, just looking for info",
  );
  const mut = useMutation({
    mutationFn: (rows: Array<{ name: string; email: string; source?: string; notes?: string }>) =>
      importFn({ data: { rows } }),
    onSuccess: (r) => {
      toast.success(`Imported ${r.count} lead${r.count === 1 ? "" : "s"} — drafts queued`);
      queryClient.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    const rows = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const parts = l.split(",").map((s) => s.trim());
        const [name, email, source, ...noteParts] = parts;
        const notes = noteParts.join(", ") || undefined;
        return { name, email, source: source || undefined, notes };
      });
    mut.mutate(rows);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-sm border border-border bg-card p-6">
        <div className="mono-caps text-muted-foreground">Import</div>
        <h2 className="mt-2 font-mono text-xl font-bold">Paste lead rows</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Format: <code>name, email, source, notes</code> — notes drive lead scoring (budget, timeline, urgent → higher).
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="mt-4 w-full rounded-sm border border-border bg-background p-3 font-mono text-xs outline-none focus:border-foreground"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-sm border border-border px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={submit}
            disabled={mut.isPending}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {mut.isPending ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

