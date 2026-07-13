import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Check, Mail, Users, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Clients />
      <Problem />

      <Workflows />
      <HowItWorks />
      <Pricing />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-4 w-4 bg-foreground" />
          <span className="font-mono text-sm font-semibold tracking-tight">FOLLOWUP</span>
        </Link>
        <nav className="hidden gap-8 md:flex">
          <a href="#workflows" className="text-sm text-muted-foreground hover:text-foreground">Workflows</a>
          <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
        </nav>
        <Link
          to="/auth"
          className="rounded-sm bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mono-caps text-muted-foreground"
        >
          [ AI agent · B2B ]
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-4 font-mono text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl"
        >
          Follow up.<br />
          <span className="text-muted-foreground">Get paid.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg"
        >
          An AI agent that drafts invoice reminders and lead responses for agencies.
          You approve, it sends, everything logged.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Start free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a href="#how" className="rounded-sm border border-border px-5 py-3 text-sm hover:bg-muted">
            See how it works
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-16 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-border bg-border"
        >
          {[
            { k: "20%+", v: "faster payment" },
            { k: "30%+", v: "faster lead reply" },
            { k: "0", v: "missed follow-ups" },
          ].map((s) => (
            <div key={s.v} className="bg-card px-6 py-6">
              <div className="font-mono text-3xl font-bold">{s.k}</div>
              <div className="mono-caps mt-1 text-muted-foreground">{s.v}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Clients() {
  const logos = [
    "NORTHWIND", "ACME/CO", "LUMEN", "AXIOM", "OBSIDIAN",
    "MERIDIAN", "HELIOS", "VANTAGE", "KAIROS", "PARALLEL",
    "STRATA", "NOVA·LABS",
  ];
  const row = [...logos, ...logos];
  return (
    <section className="border-b border-border overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mono-caps text-center text-muted-foreground">
          Companies we collaborate with
        </div>
        <div className="relative mt-10">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
          <motion.div
            className="flex gap-14 whitespace-nowrap"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 40, ease: "linear", repeat: Infinity }}
          >
            {row.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="font-mono text-2xl font-semibold tracking-tight text-muted-foreground/70 transition-colors hover:text-foreground md:text-3xl"
              >
                {name}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (

    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <div className="mono-caps text-muted-foreground">01 / Problem</div>
            <h2 className="mt-4 font-mono text-3xl font-bold md:text-4xl">
              Manual follow-ups cost agencies money.
            </h2>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <p>Invoices sit overdue for weeks because no one remembers to nudge.</p>
            <p>Fresh leads go cold while ops manually copies templates into email.</p>
            <p>Nothing gets logged, so nothing gets measured — and the same story repeats next month.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflows() {
  const items = [
    {
      icon: Mail,
      title: "Invoice reminders",
      desc: "Detects overdue invoices, drafts a firm-but-polite nudge, waits for your approval.",
    },
    {
      icon: Users,
      title: "Lead follow-ups",
      desc: "New lead in? Get a tailored first-reply draft in the queue, ready to send.",
    },
    {
      icon: ClipboardList,
      title: "History log",
      desc: "Every draft, edit, approval and send — tracked and searchable. Syncs to Sheets.",
    },
  ];
  return (
    <section id="workflows" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mono-caps text-muted-foreground">02 / Workflows</div>
        <h2 className="mt-4 font-mono text-3xl font-bold md:text-4xl">Three workflows. Zero busywork.</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-3">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group bg-card p-8"
            >
              <it.icon className="h-6 w-6 text-foreground" />
              <h3 className="mt-6 font-mono text-lg font-semibold">{it.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{it.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Connect", d: "Sign in and link your inbox." },
    { n: "02", t: "Import", d: "Bring in invoices and leads." },
    { n: "03", t: "Review", d: "AI drafts messages. You approve or edit." },
    { n: "04", t: "Send & log", d: "Message goes out. Action logged automatically." },
  ];
  return (
    <section id="how" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mono-caps text-muted-foreground">03 / Flow</div>
        <h2 className="mt-4 font-mono text-3xl font-bold md:text-4xl">Four steps. Then it runs.</h2>
        <div className="mt-12 grid gap-8 md:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <div className="font-mono text-xs text-muted-foreground">{s.n}</div>
              <div className="mt-2 h-px w-8 bg-foreground" />
              <div className="mt-4 font-mono text-lg font-semibold">{s.t}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.d}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    { name: "Starter", price: 49, features: ["1 inbox", "100 follow-ups / mo", "Sheets sync", "Email support"] },
    { name: "Growth", price: 149, features: ["3 inboxes", "1,000 follow-ups / mo", "Sheets sync", "Priority support"], featured: true },
    { name: "Pro", price: 299, features: ["Unlimited inboxes", "Unlimited follow-ups", "Custom templates", "Dedicated support"] },
  ];
  return (
    <section id="pricing" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mono-caps text-muted-foreground">04 / Pricing</div>
        <h2 className="mt-4 font-mono text-3xl font-bold md:text-4xl">Simple. Monthly. Cancel anytime.</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`p-8 ${t.featured ? "bg-foreground text-background" : "bg-card"}`}
            >
              <div className="mono-caps">{t.name}</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-mono text-5xl font-bold">${t.price}</span>
                <span className={t.featured ? "text-background/60" : "text-muted-foreground"}>/mo</span>
              </div>
              <ul className="mt-8 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className={`mt-8 block rounded-sm px-4 py-2 text-center text-sm font-medium ${
                  t.featured
                    ? "bg-background text-foreground"
                    : "border border-border hover:bg-muted"
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-10 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 bg-foreground" />
          <span className="font-mono text-sm">FOLLOWUP</span>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          © {new Date().getFullYear()} Followup. AI follow-ups for agencies.
        </div>
      </div>
    </footer>
  );
}
