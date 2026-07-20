"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState(0);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvProgress, setCsvProgress] = useState(0);
  const [csvTotal, setCsvTotal] = useState(0);
  const [csvResult, setCsvResult] = useState<string | null>(null);

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

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvResult(null);
    // Count rows
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      setCsvRows(lines.length);
    };
    reader.readAsText(file);
  };

  const importCSVData = async () => {
    if (!csvFile) return;
    setCsvLoading(true);
    setCsvResult(null);
    try {
      const text = await csvFile.text();
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      setCsvTotal(lines.length);

      // Detect if these look like invoices or leads
      const header = lines[0].toLowerCase();
      const isInvoices = header.includes("amount") || header.includes("due_date");

      let imported = 0;
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(",").map(s => s.trim());
        try {
          if (isInvoices) {
            const [client_name, client_email, amount, due_date] = parts;
            const { importInvoices } = await import("@/lib/api-client");
            await importInvoices({ rows: [{ client_name, client_email, amount: Number(amount), due_date }] });
          } else {
            const [name, email, source, ...notesParts] = parts;
            const { importLeads } = await import("@/lib/api-client");
            await importLeads({ rows: [{ name, email, source: source || undefined, notes: notesParts.join(",") || undefined }] });
          }
          imported++;
          setCsvProgress(i + 1);
        } catch (e: any) {
          console.error("Row import error:", e.message);
        }
      }

      setCsvResult(`Successfully imported ${imported} of ${lines.length} ${isInvoices ? "invoices" : "leads"}.`);
      toast.success(`Imported ${imported} ${isInvoices ? "invoices" : "leads"}`);
    } catch (e: any) {
      setCsvResult("Import failed: " + e.message);
      toast.error(e.message);
    } finally {
      setCsvLoading(false);
    }
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
              <div className="space-y-3">
              <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed border-border bg-background px-4 py-8 text-sm text-muted-foreground hover:border-foreground hover:text-foreground">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
                <span className="font-medium">{csvFile ? csvFile.name : "Upload CSV (invoices or leads)"}</span>
                <span className="mt-1 text-xs opacity-60">
                  {csvFile ? "Click to change file" : "CSV format: name/email/amount/due_date or name/email/source/notes"}
                </span>
              </label>
              {csvFile && !csvLoading && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {csvRows} rows detected
                  </span>
                  <button
                    onClick={importCSVData}
                    className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    Import {csvRows} rows
                  </button>
                </div>
              )}
              {csvLoading && (
                <div className="text-center text-xs text-muted-foreground">
                  Importing... {csvProgress} / {csvTotal}
                </div>
              )}
              {csvResult && (
                <div className="rounded-sm bg-muted p-3 text-xs text-muted-foreground">
                  {csvResult}
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Or paste CSV rows in the Invoices and Leads pages later.
              </p>
            </div>
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
