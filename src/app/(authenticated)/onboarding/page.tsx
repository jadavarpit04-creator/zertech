"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getGmailOAuthUrl } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";
import {
  Sparkles,
  Mail,
  Upload,
  Check,
  ArrowRight,
  LayoutDashboard,
  Circle,
} from "lucide-react";

const steps = [
  {
    id: "welcome",
    icon: Sparkles,
    title: "Welcome to Zertech",
    desc: "We'll help you get paid faster and never miss a lead. Setup takes under 5 minutes.",
  },
  {
    id: "inbox",
    icon: Mail,
    title: "Connect your inbox",
    desc: "Link Gmail so we can detect overdue invoices and new leads automatically.",
  },
  {
    id: "import",
    icon: Upload,
    title: "Import your data",
    desc: "Upload a CSV or paste rows to bring in existing invoices and leads.",
  },
  {
    id: "review",
    icon: Sparkles,
    title: "AI generates drafts",
    desc: "We scan and create follow-up drafts. Review and approve before anything sends.",
  },
  {
    id: "done",
    icon: LayoutDashboard,
    title: "You're all set",
    desc: "Your dashboard is ready. Run an invoice scan or import leads to start.",
  },
];

const ToneSelector = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="flex gap-2">
    {["friendly", "professional", "firm"].map((t) => (
      <button
        key={t}
        onClick={() => onChange(t)}
        className={`rounded-sm px-3 py-1.5 text-xs font-medium capitalize transition ${
          value === t
            ? "bg-foreground text-background"
            : "border border-border hover:bg-muted"
        }`}
      >
        {t}
      </button>
    ))}
  </div>
);

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [tone, setTone] = useState("professional");
  const [busy, setBusy] = useState(false);

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const skip = () => {
    toast.success("Onboarding skipped — you can always come back.");
    router.push("/dashboard");
  };

  const finish = () => {
    router.push("/dashboard");
  };

  return (
    <>
      <PageHeader
        eyebrow={`Setup · step ${step + 1} of ${steps.length}`}
        title="Welcome to Zertech"
        actions={
          <button
            onClick={step === 0 ? skip : prev}
            className="rounded-sm border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {step === 0 ? "Skip setup" : "Back"}
          </button>
        }
      />

      <div className="px-6 py-8 md:px-10">
        {/* Progress bar */}
        <div className="mb-8 flex items-center gap-2">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition ${
                i <= step ? "bg-foreground" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step overview cards (dashboard-style grid) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((s, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <div
                key={s.id}
                className={`rounded-sm border p-4 transition ${
                  active
                    ? "border-foreground bg-card"
                    : "border-border bg-background"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex rounded-sm p-2 ${
                      active ? "bg-foreground text-background" : "bg-muted"
                    }`}
                  >
                    <s.icon className="h-4 w-4" />
                  </span>
                  {done ? (
                    <Check className="h-4 w-4 text-foreground" />
                  ) : (
                    <Circle
                      className={`h-3 w-3 ${
                        active ? "text-foreground" : "text-muted-foreground"
                      }`}
                    />
                  )}
                </div>
                <div className="mono-caps mt-3 text-xs text-muted-foreground">
                  Step {i + 1}
                </div>
                <div className="mt-1 text-sm font-semibold">{s.title}</div>
              </div>
            );
          })}
        </div>

        {/* Active step detail panel */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-6 rounded-sm border border-border bg-card p-8"
        >
          <div className="mono-caps text-muted-foreground">
            {steps[step].title}
          </div>
          <h2 className="mt-2 font-mono text-2xl font-bold">
            {steps[step].desc}
          </h2>

          {step === 1 && (
            <div className="mt-6 space-y-3">
              <button
                onClick={async () => {
                  try {
                    const url = await getGmailOAuthUrl();
                    window.location.href = url;
                  } catch (e: any) {
                    toast.error(e.message ?? "Failed to connect Gmail");
                  }
                }}
                className="flex w-full items-center gap-3 rounded-sm border border-border bg-background px-4 py-3 text-sm hover:bg-muted"
              >
                <Check className="h-4 w-4 text-muted-foreground" />
                <span>Connect Gmail</span>
              </button>
              <button className="flex w-full items-center gap-3 rounded-sm border border-border bg-background px-4 py-3 text-sm opacity-50 cursor-not-allowed">
                <span>Connect Outlook</span>
                <span className="mono-caps text-xs text-muted-foreground">
                  Coming soon
                </span>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="mt-6 space-y-3">
              <button className="flex w-full items-center justify-center rounded-sm border border-dashed border-border bg-background px-4 py-8 text-sm text-muted-foreground hover:border-foreground hover:text-foreground">
                Upload CSV (invoices or leads)
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Or paste CSV rows in the Invoices and Leads pages later.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="mt-6">
              <div className="rounded-sm border border-border bg-background p-4">
                <div className="mono-caps text-xs text-muted-foreground">
                  Default tone
                </div>
                <ToneSelector value={tone} onChange={setTone} />
                <p className="mt-2 text-xs text-muted-foreground">
                  All drafts will use this tone by default. You can change it
                  per draft before sending.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <ul className="mt-6 space-y-3">
              {[
                "Inbox connected",
                "AI follow-up drafts ready for review",
                "Activity log tracking every action",
                "Dashboard showing what's pending",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          )}

          {/* Step navigation */}
          <div className="mt-8 flex items-center justify-end">
            <button
              onClick={step === steps.length - 1 ? finish : next}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {step === steps.length - 1 ? "Go to dashboard" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
