"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getProfile, updateProfile } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";

const TEAM_SIZES = ["1 (Solo)", "2-5", "6-10", "11-25", "26-50", "50+"];

export default function ProfilePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
  });
  const queryClient = useQueryClient();
  const [name, setName] = useState(data?.full_name ?? "");
  const [company, setCompany] = useState(data?.company ?? "");
  const [teamSize, setTeamSize] = useState(data?.team_size ?? "");

  const saveMut = useMutation({
    mutationFn: () => updateProfile({ full_name: name, company, team_size: teamSize }),
    onSuccess: () => {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <>
      <PageHeader eyebrow="Account" title="Profile" />
      <div className="space-y-6 p-6 md:p-10">
        <section className="rounded-sm border border-border bg-card p-6">
          <h2 className="font-mono text-lg font-semibold">Account info</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="mono-caps text-xs text-muted-foreground">Full name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
            </div>
            <div className="space-y-2">
              <label className="mono-caps text-xs text-muted-foreground">Company</label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="mono-caps text-xs text-muted-foreground">Team size</label>
              <select
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              >
                <option value="">Select…</option>
                {TEAM_SIZES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-6">
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saveMut.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </section>

        <section className="rounded-sm border border-border bg-card p-6">
          <h2 className="font-mono text-lg font-semibold">Team members</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Team management is available on the Pro plan. Invite teammates to share inboxes and approvals.
          </p>
        </section>

        <section className="rounded-sm border border-border bg-card p-6">
          <h2 className="font-mono text-lg font-semibold">API keys</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate API keys to connect Zertech to your own automation workflows (coming soon).
          </p>
        </section>
      </div>
    </>
  );
}
