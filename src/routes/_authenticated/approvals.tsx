import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { listPendingDrafts, sendDraft, discardDraft, updateDraft } from "@/lib/followup.functions";
import { PageHeader, EmptyState } from "@/components/app-shell";

const opts = queryOptions({ queryKey: ["drafts", "pending"], queryFn: () => listPendingDrafts() });

export const Route = createFileRoute("/_authenticated/approvals")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: ApprovalsPage,
  errorComponent: ({ error }) => <div className="p-8 text-sm">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function ApprovalsPage() {
  const { data } = useSuspenseQuery(opts);
  const queryClient = useQueryClient();
  const sendFn = useServerFn(sendDraft);
  const discardFn = useServerFn(discardDraft);
  const updateFn = useServerFn(updateDraft);

  const invalidate = () => queryClient.invalidateQueries();

  const send = useMutation({
    mutationFn: (id: string) => sendFn({ data: { id } }),
    onSuccess: () => { toast.success("Sent"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const discard = useMutation({
    mutationFn: (id: string) => discardFn({ data: { id } }),
    onSuccess: () => { toast.success("Discarded"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: (v: { id: string; subject: string; body: string }) => updateFn({ data: v }),
    onSuccess: () => { toast.success("Saved"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader eyebrow="Queue" title="Approvals" />
      <div className="space-y-4 p-6 md:p-10">
        {data.length === 0 ? (
          <EmptyState
            title="Inbox zero"
            hint="No drafts waiting. Run an invoice scan or import leads to generate follow-ups."
          />
        ) : (
          <AnimatePresence>
            {data.map((d) => (
              <DraftCard
                key={d.id}
                draft={d}
                onSend={() => send.mutate(d.id)}
                onDiscard={() => discard.mutate(d.id)}
                onSave={(subject, body) => save.mutate({ id: d.id, subject, body })}
                busy={send.isPending || discard.isPending || save.isPending}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </>
  );
}

function DraftCard({
  draft,
  onSend,
  onDiscard,
  onSave,
  busy,
}: {
  draft: { id: string; kind: string; subject: string; body: string; recipient_name: string; recipient_email: string; created_at: string };
  onSend: () => void;
  onDiscard: () => void;
  onSave: (subject: string, body: string) => void;
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
      className="rounded-sm border border-border bg-card p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="mono-caps rounded-sm bg-muted px-2 py-1 text-muted-foreground">
            {draft.kind}
          </span>
          <div className="mt-2 font-mono text-sm">
            To: <span className="text-muted-foreground">{draft.recipient_name} · {draft.recipient_email}</span>
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
