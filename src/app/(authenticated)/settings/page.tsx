"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listSettings, updateWorkflow, toggleIntegration, getGmailOAuthUrl, getSheetsOAuthUrl, saveIntegrationMeta, listTemplates, saveTemplate, getProfile, setPlan } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";

export default function SettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => listSettings(),
  });
  const queryClient = useQueryClient();

  const wfMut = useMutation({
    mutationFn: (v: { workflow: "invoice" | "lead"; auto_send: boolean }) => updateWorkflow(v),
    onSuccess: () => { toast.success("Updated"); queryClient.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e) => toast.error(e.message),
  });
  const intMut = useMutation({
    mutationFn: (v: { provider: "gmail" | "sheets" | "outlook" | "slack"; connected: boolean }) => toggleIntegration(v),
    onSuccess: () => { toast.success("Updated"); queryClient.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading settings…</div>;

  const wfMap = Object.fromEntries((data?.workflows ?? []).map((w: any) => [w.workflow, w]));
  const intMap = Object.fromEntries((data?.integrations ?? []).map((i: any) => [i.provider, i]));
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
                    onClick={async () => {
                      if (connected) {
                        intMut.mutate({ provider: p.id, connected: false });
                      } else if (p.id === "gmail") {
                        try {
                          const url = await getGmailOAuthUrl();
                          window.location.href = url;
                        } catch (e: any) {
                          toast.error(e.message ?? "Failed to connect Gmail");
                        }
                      } else if (p.id === "sheets") {
                        try {
                          const url = await getSheetsOAuthUrl();
                          window.location.href = url;
                        } catch (e: any) {
                          toast.error(e.message ?? "Failed to connect Sheets");
                        }
                      } else {
                        intMut.mutate({ provider: p.id, connected: true });
                      }
                    }}
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
            Gmail and Google Sheets use OAuth — connect once and drafts send/sync automatically.
          </p>
        </section>

        <section>
          <h2 className="mono-caps text-muted-foreground">Email templates</h2>
          <TemplatesPanel />
        </section>

        <section>
          <h2 className="mono-caps text-muted-foreground">Notifications</h2>
          <div className="mt-4 space-y-4 rounded-sm border border-border bg-card p-6">
            <p className="text-xs text-muted-foreground">
              Get alerted on Slack or Telegram when new drafts are ready for review.
            </p>
            <SlackTelegramForm
              slackConnected={(intMap["slack"]?.meta as any)?.webhook_url != null}
              telegramConnected={
                (intMap["slack"]?.meta as any)?.telegram_bot_token != null &&
                (intMap["slack"]?.meta as any)?.telegram_chat_id != null
              }
            />
          </div>
        </section>
      </div>
    </>
  );
}

function SlackTelegramForm({
  slackConnected,
  telegramConnected,
}: {
  slackConnected: boolean;
  telegramConnected: boolean;
}) {
  const [webhook, setWebhook] = useState("");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const queryClient = useQueryClient();
  const saveMut = useMutation({
    mutationFn: (meta: Record<string, any>) =>
      saveIntegrationMeta({ provider: "slack", meta }),
    onSuccess: () => {
      toast.success("Notification settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <div className="font-mono text-sm font-semibold">
          Slack {slackConnected && <span className="text-green-500">• connected</span>}
        </div>
        <input
          placeholder="https://hooks.slack.com/services/..."
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        />
      </div>
      <div className="space-y-3">
        <div className="font-mono text-sm font-semibold">
          Telegram {telegramConnected && <span className="text-green-500">• connected</span>}
        </div>
        <input
          placeholder="Bot token (123:ABC...)"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        />
        <input
          placeholder="Chat ID (e.g. 123456789)"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        />
      </div>
      <div className="md:col-span-2">
        <button
          onClick={() =>
            saveMut.mutate({
              webhook_url: webhook || undefined,
              telegram_bot_token: botToken || undefined,
              telegram_chat_id: chatId || undefined,
            })
          }
          className="rounded-sm bg-foreground px-4 py-1.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          {saveMut.isPending ? "Saving…" : "Save notifications"}
        </button>
      </div>
    </div>
  );
}

function TemplatesPanel() {
  const { data, isLoading } = useQuery({ queryKey: ["templates"], queryFn: () => listTemplates() });
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<null | { id?: string; kind: "invoice" | "lead"; name: string; subject: string; body: string }>(null);

  const saveMut = useMutation({
    mutationFn: (t: { id?: string; kind: "invoice" | "lead"; name: string; subject: string; body: string }) => saveTemplate(t),
    onSuccess: () => { toast.success("Template saved"); setEditing(null); queryClient.invalidateQueries({ queryKey: ["templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="mt-4 text-sm text-muted-foreground">Loading templates…</div>;

  return (
    <div className="mt-4 space-y-4 rounded-sm border border-border bg-card p-6">
      {(data ?? []).length === 0 && !editing && (
        <p className="text-xs text-muted-foreground">No templates yet. Create one to power your AI drafts.</p>
      )}
      {(data ?? []).map((t: any) => (
        <div key={t.id} className="rounded-sm border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-sm font-semibold">{t.name}</div>
            <span className="mono-caps rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">{t.kind}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Subject: {t.subject}</div>
          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.body}</div>
          <button
            onClick={() => setEditing({ id: t.id, kind: t.kind, name: t.name, subject: t.subject, body: t.body })}
            className="mt-3 rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Edit
          </button>
        </div>
      ))}
      {!editing ? (
        <button
          onClick={() => setEditing({ kind: "invoice", name: "", subject: "", body: "" })}
          className="rounded-sm bg-foreground px-4 py-1.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          + Create template
        </button>
      ) : (
        <div className="space-y-3 rounded-sm border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={editing.kind}
              onChange={(e) => setEditing({ ...editing, kind: e.target.value as "invoice" | "lead" })}
              className="rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
            >
              <option value="invoice">Invoice</option>
              <option value="lead">Lead</option>
            </select>
            <input
              placeholder="Template name"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </div>
          <input
            placeholder="Subject line"
            value={editing.subject}
            onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <textarea
            placeholder="Body (use [Name], [Amount], [DueDate] placeholders)"
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            rows={6}
            className="w-full rounded-sm border border-border bg-background p-3 text-sm outline-none focus:border-foreground"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="rounded-sm border border-border px-4 py-2 text-sm">Cancel</button>
            <button
              onClick={() => saveMut.mutate(editing)}
              disabled={saveMut.isPending || !editing.name || !editing.subject}
              className="rounded-sm bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {saveMut.isPending ? "Saving…" : "Save template"}
            </button>
          </div>
        </div>
      )}

      <section>
        <h2 className="mono-caps text-muted-foreground">Billing</h2>
        <BillingPanel />
      </section>
    </div>
  );
}

const PLANS = [
  { id: "starter", name: "Starter", price: "₹2,499 / $49", sub: "Perfect for freelancers" },
  { id: "growth", name: "Growth", price: "₹7,499 / $149", sub: "For growing agencies" },
  { id: "pro", name: "Pro", price: "₹14,999 / $299", sub: "Unlimited scale + team" },
] as const;

function BillingPanel() {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const currentPlan = (profile as any)?.plan ?? "starter";
  const planMut = useMutation({
    mutationFn: (plan: "starter" | "growth" | "pro") => setPlan(plan),
    onSuccess: () => { toast.success("Plan updated"); queryClient.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      {PLANS.map((p) => {
        const active = currentPlan === p.id;
        return (
          <div
            key={p.id}
            className={`rounded-sm border bg-card p-6 ${active ? "border-foreground" : "border-border"}`}
          >
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm font-semibold">{p.name}</div>
              {active && (
                <span className="mono-caps rounded-sm bg-foreground px-2 py-1 text-xs text-background">
                  Current
                </span>
              )}
            </div>
            <div className="mt-3 font-mono text-2xl font-bold tracking-tight">{p.price}</div>
            <div className="mt-1 text-xs text-muted-foreground">{p.sub}</div>
            <button
              onClick={() => planMut.mutate(p.id)}
              disabled={active || planMut.isPending}
              className={`mt-5 w-full rounded-sm px-4 py-2 text-sm font-medium ${
                active
                  ? "cursor-default border border-border text-muted-foreground"
                  : "bg-foreground text-background hover:opacity-90"
              } disabled:opacity-50`}
            >
              {active ? "Active" : planMut.isPending ? "…" : "Switch plan"}
            </button>
          </div>
        );
      })}
      <p className="mt-3 text-xs text-muted-foreground md:col-span-3">
        Plans are billed monthly. 14-day free trial on all tiers. Cancel anytime from your account.
      </p>
    </div>
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
