"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listInvoices, importInvoices, updateInvoice, deleteInvoice } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/app-shell";
import ExportButton from "./export-button";

type Tab = "pending" | "sent" | "paid";

export default function InvoicesPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const { data } = useQuery({
    queryKey: ["invoices", tab],
    queryFn: () => listInvoices(),
  });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [urgency, setUrgency] = useState<"all" | "urgent">("all");
  const [editing, setEditing] = useState<any>(null);

  const queryClient = useQueryClient();
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteInvoice({ id }),
    onSuccess: () => { toast.success("Invoice deleted"); queryClient.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (data: any) => updateInvoice(data),
    onSuccess: () => { toast.success("Invoice updated"); queryClient.invalidateQueries({ queryKey: ["invoices"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });



  const filtered = (data ?? []).filter((i: any) => {
    if (tab === "pending") return i.status === "pending" || i.status === "overdue";
    if (tab === "sent") return i.status === "sent";
    if (tab === "paid") return i.status === "paid";
    return true;
  });
  const filteredWithUrgency = filtered.filter((i: any) => {
    const matchesSearch = !search || 
      i.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.client_email?.toLowerCase().includes(search.toLowerCase());
    const matchesUrgency = urgency === "all" || (urgency === "urgent" && 
      (i.status === "overdue" && (
        Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000) >= 7
      )));
    return matchesSearch && matchesUrgency;
  });

  return (
    <>
      <PageHeader
        eyebrow="Workflow"
        title="Invoices"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-sm border border-border p-1">
              {(["pending", "sent", "paid"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-sm px-3 py-1.5 text-xs capitalize ${
                    tab === t
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "pending" ? `${t} (${(data ?? []).filter((i: any) => i.status === "pending" || i.status === "overdue").length})` : t}
                </button>
              ))}
            </div>
            <ExportButton type="invoices" />
            <button
              onClick={() => setOpen(true)}
              className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Import invoices
            </button>
          </div>
        }
      />
      <div className="p-6 md:p-10">
        {/* Search & Filter */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client name or email..."
              className="w-full rounded-sm border border-border bg-background px-3 py-2 pl-8 text-sm outline-none focus:border-foreground"
            />
            <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <div className="flex gap-1 rounded-sm border border-border p-1">
            {(["all", "urgent"]).map((u) => (
              <button
                key={u}
                onClick={() => setUrgency(u as "all" | "urgent")}
                className={"rounded-sm px-3 py-1.5 text-xs capitalize " + (urgency === u ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {u === "all" ? "All" : "Urgent (7d+ overdue)"}
              </button>
            ))}
          </div>
        </div>
        {filteredWithUrgency.length === 0 ? (
          <EmptyState
            title={
              tab === "pending"
                ? "No pending invoices"
                : tab === "sent"
                  ? "No sent invoices"
                  : "No paid invoices"
            }
            hint={
              tab === "pending"
                ? "Import invoices to start tracking overdue payments."
                : tab === "sent"
                  ? "Sent reminders will appear here."
                  : "Marked-as-paid invoices will appear here."
            }
            action={
              tab === "pending" ? (
                <button
                  onClick={() => setOpen(true)}
                  className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Import invoices
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-sm border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left">
                  <Th>Client</Th>
                  <Th>Email</Th>
                  <Th>Amount</Th>
                  <Th>Due</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((i: any) => (
                  <tr
                    key={i.id}
                    onClick={() => setSelected(i)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <Td>{i.client_name}</Td>
                    <Td className="text-muted-foreground">{i.client_email}</Td>
                    <Td className="font-mono">${i.amount}</Td>
                    <Td className="font-mono">{i.due_date}</Td>
                    <Td><StatusPill status={i.status} /></Td>
                    <Td>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEditing(i)}
                          className="rounded-sm border border-border px-2.5 py-1 text-xs hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Delete this invoice?")) deleteMut.mutate(i.id);
                          }}
                          disabled={deleteMut.isPending}
                          className="rounded-sm border border-border px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && <ImportModal onClose={() => setOpen(false)} />}
      {selected && <InvoiceDetailModal invoice={selected} onClose={() => setSelected(null)} />}
      {editing && (
        <EditInvoiceModal
          invoice={editing}
          onClose={() => setEditing(null)}
          onSave={(data) => updateMut.mutate(data)}
          busy={updateMut.isPending}
        />
      )}
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
    sent: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`mono-caps rounded-sm px-2 py-1 ${styles[status] ?? ""}`}>{status}</span>
  );
}

// ------ Detail Modal ------

function InvoiceDetailModal({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const daysOverdue =
    invoice.status === "paid"
      ? 0
      : Math.max(0, Math.round((Date.now() - new Date(invoice.due_date).getTime()) / 86400000));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-sm border border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="mono-caps text-muted-foreground">Invoice detail</div>
            <h2 className="mt-1 font-mono text-xl font-bold">{invoice.client_name}</h2>
          </div>
          <button onClick={onClose} className="rounded-sm border border-border px-3 py-1 text-sm">
            Close
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mono-caps text-xs text-muted-foreground">Amount</div>
            <div className="mt-1 font-mono text-lg font-semibold">${invoice.amount}</div>
          </div>
          <div>
            <div className="mono-caps text-xs text-muted-foreground">Due date</div>
            <div className="mt-1 font-mono text-lg font-semibold">{invoice.due_date}</div>
          </div>
          <div>
            <div className="mono-caps text-xs text-muted-foreground">Days overdue</div>
            <div className="mt-1 font-mono text-lg font-semibold">{daysOverdue}</div>
          </div>
          <div>
            <div className="mono-caps text-xs text-muted-foreground">Status</div>
            <div className="mt-1"><StatusPill status={invoice.status} /></div>
          </div>
          <div className="sm:col-span-2">
            <div className="mono-caps text-xs text-muted-foreground">Client email</div>
            <div className="mt-1 text-sm">{invoice.client_email}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------ Import Modal ------

function ImportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(
    "Acme Co, billing@acme.com, 2500, 2026-06-01, INV-001\nGlobex, ap@globex.com, 800, 2026-05-15",
  );
  const mut = useMutation({
    mutationFn: (rows: Array<{ client_name: string; client_email: string; amount: number; due_date: string; invoice_number?: string }>) =>
      importInvoices({ rows }),
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
        const [client_name, client_email, amount, due_date, invoice_number] = l.split(",").map((s) => s.trim());
        return { client_name, client_email, amount: Number(amount), due_date, ...(invoice_number ? { invoice_number } : {}) };
      });
    mut.mutate(rows);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-sm border border-border bg-card p-6">
        <div className="mono-caps text-muted-foreground">Import</div>
        <h2 className="mt-2 font-mono text-xl font-bold">Paste invoice rows</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Format: <code>client_name, email, amount, YYYY-MM-DD, invoice_number</code> (invoice_number optional)
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

// ------ Edit Modal ------

function EditInvoiceModal({ invoice, onClose, onSave, busy }: { invoice: any; onClose: () => void; onSave: (data: any) => void; busy: boolean }) {
  const [name, setName] = useState(invoice.client_name);
  const [email, setEmail] = useState(invoice.client_email);
  const [amount, setAmount] = useState(String(invoice.amount));
  const [dueDate, setDueDate] = useState(invoice.due_date);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: invoice.id,
      client_name: name,
      client_email: email,
      amount: Number(amount),
      due_date: dueDate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-sm border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mono-caps text-muted-foreground">Edit invoice</div>
        <h2 className="mt-2 font-mono text-xl font-bold">{invoice.client_name}</h2>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mono-caps mb-1 block text-xs text-muted-foreground">Client name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground" />
          </div>
          <div>
            <label className="mono-caps mb-1 block text-xs text-muted-foreground">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground" />
          </div>
          <div>
            <label className="mono-caps mb-1 block text-xs text-muted-foreground">Amount</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground" />
          </div>
          <div>
            <label className="mono-caps mb-1 block text-xs text-muted-foreground">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-sm border border-border px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}





