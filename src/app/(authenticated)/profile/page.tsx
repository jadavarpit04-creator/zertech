"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getProfile, updateProfile } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";

const TEAM_SIZES: Array<{ value: string; label: string; sub: string }> = [
  { value: "1 (Solo)", label: "1", sub: "Solo" },
  { value: "2-5", label: "2-5", sub: "Small" },
  { value: "6-10", label: "6-10", sub: "Growing" },
  { value: "11-25", label: "11-25", sub: "Team" },
  { value: "26-50", label: "26-50", sub: "Scale" },
  { value: "50+", label: "50+", sub: "Enterprise" },
];

export default function ProfilePage() {
  const { data } = useQuery({
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
              <div className="grid grid-cols-3 gap-2">
                {TEAM_SIZES.map((s) => {
                  const active = teamSize === s.value;
                  return (
                    <button
                      type="button"
                      key={s.value}
                      onClick={() => setTeamSize(s.value)}
                      className={
                        "flex flex-col items-center justify-center rounded-sm border px-2 py-2.5 text-center transition " +
                        (active
                          ? "border-foreground bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-muted")
                      }
                    >
                      <span className="text-sm font-semibold leading-none">{s.label}</span>
                      <span
                        className={
                          "mt-1 text-[10px] leading-none " +
                          (active ? "text-primary-foreground/70" : "text-muted-foreground")
                        }
                      >
                        {s.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
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
