import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listSettings, updateWorkflow, toggleIntegration } from "@/lib/followup.functions";
import { PageHeader } from "@/components/app-shell";

const opts = queryOptions({ queryKey: ["settings"], queryFn: () => listSettings() });

export const Route = createFileRoute("/_authenticated/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: SettingsPage,
  errorComponent: ({ error }) => <div className="p-8 text-sm">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function SettingsPage() {
  const { data } = useSuspenseQuery(opts);
  const queryClient = useQueryClient();
  const wfFn = useServerFn(updateWorkflow);
  const intFn = useServerFn(toggleIntegration);

  const wfMut = useMutation({
    mutationFn: (v: { workflow: "invoice" | "lead"; auto_send: boolean }) => wfFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); queryClient.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e) => toast.error(e.message),
  });
  const intMut = useMutation({
    mutationFn: (v: { provider: "gmail" | "sheets" | "outlook" | "slack"; connected: boolean }) =>
      intFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); queryClient.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e) => toast.error(e.message),
  });

  const wfMap = Object.fromEntries(data.workflows.map((w) => [w.workflow, w]));
  const intMap = Object.fromEntries(data.integrations.map((i) => [i.provider, i]));
  const providers: Array<{ id: "gmail" | "sheets" | "outlook" | "slack"; label: string; desc: string }> = [
    { id: "gmail", label: "Gmail", desc: "Send follow-ups from your Gmail inbox." },
    { id: "sheets", label: "Google Sheets", desc: "Sync leads and invoices to a spreadsheet." },
    { id: "outlook", label: "Outlook", desc: "Send follow-ups from Outlook." },
    { id: "slack", label: "Slack", desc: "Get notified when new drafts arrive." },
  ];

  return (
    <>
      <PageHeader eyebrow="Config" title="Settings" />
      <div className="space-y-10 p-6 md:p-10">
        <section>
          <h2 className="mono-caps text-muted-foreground">Workflow — approval mode</h2>
          <div className="mt-4 divide-y divide-border overflow-hidden rounded-sm border border-border bg-card">
            {(["invoice", "lead"] as const).map((w) => {
              const s = wfMap[w];
              const autoSend = s?.auto_send ?? false;
              return (
                <div key={w} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <div className="font-mono text-sm font-semibold capitalize">{w} follow-ups</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {autoSend
                        ? "Auto-sending drafts without approval."
                        : "Every draft requires your approval before sending."}
                    </div>
                  </div>
                  <Toggle
                    checked={autoSend}
                    onChange={(v) => wfMut.mutate({ workflow: w, auto_send: v })}
                    label={autoSend ? "Auto-send" : "Approval on"}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mono-caps text-muted-foreground">Integrations</h2>
          <div className="mt-4 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-2">
            {providers.map((p) => {
              const connected = intMap[p.id]?.connected ?? false;
              return (
                <div key={p.id} className="flex items-center justify-between gap-4 bg-card p-6">
                  <div>
                    <div className="font-mono text-sm font-semibold">{p.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{p.desc}</div>
                  </div>
                  <button
                    onClick={() => intMut.mutate({ provider: p.id, connected: !connected })}
                    className={`rounded-sm px-3 py-1.5 text-xs font-medium ${
                      connected
                        ? "bg-foreground text-background"
                        : "border border-border hover:bg-muted"
                    }`}
                  >
                    {connected ? "Connected" : "Connect"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Connections are simulated in MVP — actual sending and syncing are logged to the activity feed.
          </p>
        </section>
      </div>
    </>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
    >
      <span className="mono-caps text-muted-foreground">{label}</span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-foreground" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-background transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}
