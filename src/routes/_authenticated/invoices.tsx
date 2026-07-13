import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listInvoices, importInvoices } from "@/lib/followup.functions";
import { PageHeader, EmptyState } from "@/components/app-shell";

const opts = queryOptions({ queryKey: ["invoices"], queryFn: () => listInvoices() });

export const Route = createFileRoute("/_authenticated/invoices")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: InvoicesPage,
  errorComponent: ({ error }) => <div className="p-8 text-sm">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function InvoicesPage() {
  const { data } = useSuspenseQuery(opts);
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Workflow"
        title="Invoices"
        actions={
          <button
            onClick={() => setOpen(true)}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Import invoices
          </button>
        }
      />
      <div className="p-6 md:p-10">
        {data.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            hint="Paste CSV rows to import overdue invoices for follow-up."
            action={
              <button
                onClick={() => setOpen(true)}
                className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Import invoices
              </button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-sm border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left">
                  <Th>Client</Th><Th>Email</Th><Th>Amount</Th><Th>Due</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((i) => (
                  <tr key={i.id}>
                    <Td>{i.client_name}</Td>
                    <Td className="text-muted-foreground">{i.client_email}</Td>
                    <Td className="font-mono">${i.amount}</Td>
                    <Td className="font-mono">{i.due_date}</Td>
                    <Td><StatusPill status={i.status} /></Td>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="mono-caps px-4 py-3 text-muted-foreground">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    overdue: "bg-foreground text-background",
    paid: "border border-border text-muted-foreground",
  };
  return (
    <span className={`mono-caps rounded-sm px-2 py-1 ${styles[status] ?? ""}`}>{status}</span>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const importFn = useServerFn(importInvoices);
  const [text, setText] = useState(
    "Acme Co, billing@acme.com, 2500, 2026-06-01\nGlobex, ap@globex.com, 800, 2026-05-15",
  );
  const mut = useMutation({
    mutationFn: (rows: Array<{ client_name: string; client_email: string; amount: number; due_date: string }>) =>
      importFn({ data: { rows } }),
    onSuccess: (r) => {
      toast.success(`Imported ${r.count} invoice${r.count === 1 ? "" : "s"}`);
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
        const [client_name, client_email, amount, due_date] = l.split(",").map((s) => s.trim());
        return {
          client_name,
          client_email,
          amount: Number(amount),
          due_date,
        };
      });
    mut.mutate(rows);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-sm border border-border bg-card p-6">
        <div className="mono-caps text-muted-foreground">Import</div>
        <h2 className="mt-2 font-mono text-xl font-bold">Paste invoice rows</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Format: <code>client_name, email, amount, YYYY-MM-DD</code>
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
