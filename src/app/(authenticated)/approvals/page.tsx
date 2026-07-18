"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { listPendingDrafts, listArchivedDrafts, listScheduledDrafts, sendDraft, discardDraft, updateDraft, bulkApprove, scheduleDraft } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/app-shell";

export default function ApprovalsPage() {
  const [tab, setTab] = useState<"pending" | "scheduled" | "archive">("pending");
  const { data, isLoading } = useQuery({
    queryKey: ["drafts", tab],
    queryFn: () =>
      tab === "pending"
        ? listPendingDrafts()
        : tab === "scheduled"
          ? listScheduledDrafts()
          : listArchivedDrafts(),
  });
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scheduleTarget, setScheduleTarget] = useState<{ id: string; recipient: string } | null>(null);

  const invalidate = () => queryClient.invalidateQueries();

  const sendMut = useMutation({
    mutationFn: (id: string) => sendDraft({ id }),
    onSuccess: () => { toast.success("Sent"); invalidate(); setSelectedIds(new Set()); },
    onError: (e) => toast.error(e.message),
  });
  const discardMut = useMutation({
    mutationFn: (id: string) => discardDraft({ id }),
    onSuccess: () => { toast.success("Discarded"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const saveMut = useMutation({
    mutationFn: (v: { id: string; subject: string; body: string }) => updateDraft(v),
    onSuccess: () => { toast.success("Saved"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const bulkMut = useMutation({
    mutationFn: (ids: string[]) => bulkApprove(ids),
    onSuccess: (r) => { toast.success(`Approved ${r.count} draft${r.count === 1 ? "" : "s"}`); invalidate(); setSelectedIds(new Set()); },
    onError: (e) => toast.error(e.message),
  });
  const scheduleMut = useMutation({
    mutationFn: (v: { id: string; scheduled_for: string }) => scheduleDraft(v),
    onSuccess: () => { toast.success("Scheduled"); invalidate(); setScheduleTarget(null); },
    onError: (e) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading approvals…</div>;

  return (
    <>
      <PageHeader
        eyebrow="Queue"
        title="Drafts"
        actions={
          <div className="flex gap-1 rounded-sm border border-border p-1">
            <button
              onClick={() => setTab("pending")}
              className={`rounded-sm px-3 py-1.5 text-xs ${tab === "pending" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Pending approval
            </button>
            <button
              onClick={() => setTab("scheduled")}
              className={`rounded-sm px-3 py-1.5 text-xs ${tab === "scheduled" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setTab("archive")}
              className={`rounded-sm px-3 py-1.5 text-xs ${tab === "archive" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Archive
            </button>
          </div>
        }
      />
      <div className="space-y-4 p-6 md:p-10">
        {!data || data.length === 0 ? (
          <EmptyState
            title={
              tab === "archive"
                ? "Nothing archived"
                : tab === "scheduled"
                  ? "Nothing scheduled"
                  : "Inbox zero"
            }
            hint={
              tab === "archive"
                ? "Discarded drafts will appear here."
                : tab === "scheduled"
                  ? "Drafts you schedule will wait here until their send time."
                  : "No drafts waiting. Run an invoice scan or import leads to generate follow-ups."
            }
          />
        ) : tab === "archive" ? (
          <div className="space-y-4">
            {data.map((d: any) => (
              <div key={d.id} className="rounded-sm border border-border bg-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="mono-caps rounded-sm bg-muted px-2 py-1 text-muted-foreground">{d.kind}</span>
                    <div className="mt-2 font-mono text-base font-semibold">{d.subject}</div>
                    <div className="mt-1 text-sm text-muted-foreground">To: {d.recipient_name} · {d.recipient_email}</div>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        ) : tab === "scheduled" ? (
          <div className="space-y-4">
            {data.map((d: any) => (
              <div key={d.id} className="rounded-sm border border-border bg-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="mono-caps rounded-sm bg-muted px-2 py-1 text-muted-foreground">{d.kind}</span>
                    <div className="mt-2 font-mono text-base font-semibold">{d.subject}</div>
                    <div className="mt-1 text-sm text-muted-foreground">To: {d.recipient_name} · {d.recipient_email}</div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      Sends {new Date(d.scheduled_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => sendMut.mutate(d.id)}
                    disabled={sendMut.isPending}
                    className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    Send now
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence>
            {data.map((d: any) => (
              <DraftCard
                key={d.id}
                draft={d}
                selected={selectedIds.has(d.id)}
                onToggleSelect={() => toggleSelect(d.id)}
                onSend={() => sendMut.mutate(d.id)}
                onDiscard={() => discardMut.mutate(d.id)}
                onSave={(subject, body) => saveMut.mutate({ id: d.id, subject, body })}
                onSchedule={() => setScheduleTarget({ id: d.id, recipient: d.recipient_name })}
                busy={sendMut.isPending || discardMut.isPending || saveMut.isPending || bulkMut.isPending}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
      {scheduleTarget && (
        <ScheduleModal
          recipient={scheduleTarget.recipient}
          onConfirm={(scheduled_for) => scheduleMut.mutate({ id: scheduleTarget.id, scheduled_for })}
          onClose={() => setScheduleTarget(null)}
          loading={scheduleMut.isPending}
        />
      )}
    </>
  );
}

function DraftCard({
  draft,
  selected,
  onToggleSelect,
  onSend,
  onDiscard,
  onSave,
  onSchedule,
  busy,
}: {
  draft: { id: string; kind: string; subject: string; body: string; recipient_name: string; recipient_email: string; created_at: string };
  selected: boolean;
  onToggleSelect: () => void;
  onSend: () => void;
  onDiscard: () => void;
  onSave: (subject: string, body: string) => void;
  onSchedule: () => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`rounded-sm border bg-card p-6 ${selected ? "border-foreground" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="mt-1 h-4 w-4 rounded-sm border-border accent-foreground"
          />
          <div>
            <span className="mono-caps rounded-sm bg-muted px-2 py-1 text-muted-foreground">
              {draft.kind}
            </span>
            <div className="mt-2 font-mono text-sm">
              To: <span className="text-muted-foreground">{draft.recipient_name} · {draft.recipient_email}</span>
            </div>
          </div>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {new Date(draft.created_at).toLocaleString()}
        </div>
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full rounded-sm border border-border bg-background p-3 text-sm outline-none focus:border-foreground"
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="font-mono text-base font-semibold">{draft.subject}</div>
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">{draft.body}</div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {editing ? (
          <>
            <button
              onClick={() => { setEditing(false); setSubject(draft.subject); setBody(draft.body); }}
              className="rounded-sm border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSave(subject, body); setEditing(false); }}
              disabled={busy}
              className="rounded-sm border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Save
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onDiscard}
              disabled={busy}
              className="rounded-sm border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Discard
            </button>
            <button
              onClick={() => setEditing(true)}
              className="rounded-sm border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Edit
            </button>
            <button
              onClick={onSchedule}
              className="rounded-sm border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Schedule
            </button>
            <button
              onClick={onSend}
              disabled={busy}
              className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Approve & send
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

function ScheduleModal({
  recipient,
  onConfirm,
  onClose,
  loading,
}: {
  recipient: string;
  onConfirm: (scheduled_for: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [datetime, setDatetime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-sm border border-border bg-card p-6">
        <div className="mono-caps text-muted-foreground">Schedule</div>
        <h2 className="mt-2 font-mono text-xl font-bold">Schedule send</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Send to <span className="font-medium text-foreground">{recipient}</span>
        </p>
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          className="mt-4 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-sm border border-border px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={() => onConfirm(new Date(datetime).toISOString())}
            disabled={loading || !datetime}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {loading ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
