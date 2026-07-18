'use client';

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Mail, Users, ClipboardList, Zap, Shield, LineChart, Clock, Quote, Minus, Plus } from "lucide-react";
import { useState } from "react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Clients />
      <Problem />
      <Metrics />
      <Workflows />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}


function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-24 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="h-24 w-auto" />
        </Link>
        <nav className="hidden gap-8 md:flex">
          <a href="#workflows" className="text-sm text-muted-foreground hover:text-foreground">Workflows</a>
          <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/auth?mode=signup"
            className="rounded-sm bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Get started
          </Link>
          <Link
            href="/auth"
            className="rounded-sm border border-border px-4 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-4 font-mono text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl"
        >
          Zertech.<br />
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
            href="/auth"
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
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_API_KEY;
  const companies = [
    { name: "Stripe", domain: "stripe.com" },
    { name: "Notion", domain: "notion.so" },
    { name: "Linear", domain: "linear.app" },
    { name: "Vercel", domain: "vercel.com" },
    { name: "Figma", domain: "figma.com" },
    { name: "Slack", domain: "slack.com" },
    { name: "Shopify", domain: "shopify.com" },
    { name: "HubSpot", domain: "hubspot.com" },
  ];
  // Duplicate for seamless loop
  const row = [...companies, ...companies];
  return (
    <section className="border-b border-border overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mono-caps text-center text-muted-foreground">
          Companies we collaborate with
        </div>
        <div className="relative mt-10 overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
          <div className="marquee-track flex items-center gap-14 whitespace-nowrap">
            {row.map((c, i) => (
              <div
                key={`${c.domain}-${i}`}
                className="group flex shrink-0 items-center gap-3 opacity-70 transition hover:opacity-100"
              >
                <img
                  src={`https://img.logo.dev/${c.domain}?token=${token}&size=120&format=png&greyscale=true`}
                  alt={`${c.name} logo`}
                  loading="lazy"
                  className="h-8 w-8 rounded-md grayscale transition group-hover:grayscale-0 md:h-10 md:w-10"
                />
                <span className="font-mono text-base font-semibold tracking-tight md:text-lg">
                  {c.name}
                </span>
              </div>
            ))}
          </div>
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
                href="/auth"
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

function Metrics() {
  const stats = [
    { k: "47 hrs", v: "industry avg lead response time" },
    { k: "5 mins", v: "response = 21× more qualified leads" },
    { k: "15–25%", v: "revenue lost to late invoices" },
    { k: "8–12 hrs", v: "weekly manual follow-up work" },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mono-caps text-muted-foreground">By the numbers</div>
        <h2 className="mt-4 max-w-2xl font-mono text-3xl font-bold md:text-4xl">
          The cost of doing follow-ups by hand.
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.v}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="bg-card p-6"
            >
              <div className="font-mono text-3xl font-bold md:text-4xl">{s.k}</div>
              <div className="mono-caps mt-2 text-muted-foreground">{s.v}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: Zap,
      title: "AI-drafted, human-approved",
      desc: "Every reminder and reply is generated with context — you approve, edit, or discard in one click.",
    },
    {
      icon: LineChart,
      title: "Lead scoring 1–5",
      desc: "Intent signals (budget, timeline, urgency) auto-rank leads so the hot ones surface at the top.",
    },
    {
      icon: Clock,
      title: "Escalation sequence",
      desc: "Overdue invoice at 7, 14, 30 days — friendly → professional → firm. No awkwardness required.",
    },
    {
      icon: Shield,
      title: "Approval-first by default",
      desc: "Nothing sends without you. Toggle auto-send per workflow when you're ready to trust it.",
    },
    {
      icon: Mail,
      title: "Gmail + Outlook",
      desc: "Connect your existing inbox. We send from your address, threads land where they belong.",
    },
    {
      icon: ClipboardList,
      title: "Sheets sync",
      desc: "Every action written to Google Sheets in real time — audit-ready without lifting a finger.",
    },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mono-caps text-muted-foreground">Features</div>
        <h2 className="mt-4 font-mono text-3xl font-bold md:text-4xl">
          Built for agencies that can&apos;t afford to drop follow-ups.
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-3">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="bg-card p-8"
            >
              <it.icon className="h-5 w-5" />
              <h3 className="mt-6 font-mono text-lg font-semibold">{it.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{it.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const quotes = [
    {
      q: "We recovered ₹4.2L of overdue invoices in the first month. The drafts sound like me, and I still get to approve every send.",
      n: "Raj M.",
      r: "Founder, digital marketing agency",
    },
    {
      q: "Lead response went from a day to under 10 minutes. Close rate on inbound went up almost 2×.",
      n: "Priya S.",
      r: "Ops Manager, SaaS dev shop",
    },
    {
      q: "I stopped dreading Monday. All my follow-ups are queued and ready before I open Gmail.",
      n: "Arjun K.",
      r: "Freelance designer",
    },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mono-caps text-muted-foreground">Voices</div>
        <h2 className="mt-4 font-mono text-3xl font-bold md:text-4xl">
          Agencies that stopped chasing.
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-3">
          {quotes.map((t, i) => (
            <motion.div
              key={t.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="flex flex-col justify-between bg-card p-8"
            >
              <Quote className="h-6 w-6 text-muted-foreground" />
              <p className="mt-6 text-sm leading-relaxed">&quot;{t.q}&quot;</p>
              <div className="mt-8">
                <div className="font-mono text-sm font-semibold">{t.n}</div>
                <div className="mono-caps mt-1 text-muted-foreground">{t.r}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: "Will messages send automatically without me?",
      a: "No — approval is on by default. Every draft waits for you to click send. You can flip on auto-send per workflow once you trust it.",
    },
    {
      q: "Do you support Outlook or only Gmail?",
      a: "Gmail first, Outlook next. Both use official APIs so deliverability stays yours, not ours.",
    },
    {
      q: "Where does the data live?",
      a: "Your data sits in your workspace, encrypted at rest, scoped to your account only. 30-day retention by default.",
    },
    {
      q: "How is lead scoring calculated?",
      a: "Intent signals in the source and notes — budget, timeline, urgency keywords lift the score, generic inquiries lower it. Range 1–5, high-priority sorts first.",
    },
    {
      q: "Can I edit templates?",
      a: "Yes. Every draft is editable inline before you send. Pro plan unlocks custom template libraries per workflow.",
    },
    {
      q: "What if I cancel?",
      a: "Cancel any time. Your data stays exportable for 30 days, then it's deleted for good.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <div className="mono-caps text-muted-foreground">FAQ</div>
        <h2 className="mt-4 font-mono text-3xl font-bold md:text-4xl">Answers.</h2>
        <div className="mt-10 divide-y divide-border rounded-sm border border-border bg-card">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <button
                key={it.q}
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full px-6 py-5 text-left"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-sm font-semibold">{it.q}</span>
                  {isOpen ? <Minus className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
                </div>
                {isOpen && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-sm text-muted-foreground"
                  >
                    {it.a}
                  </motion.p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="border-b border-border bg-foreground text-background">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="mono-caps text-background/60">Start today</div>
        <h2 className="mt-4 font-mono text-4xl font-bold md:text-5xl">
          Stop chasing. Start collecting.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-background/70">
          14-day free trial. No credit card. Set up your first workflow in under 5 minutes.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 rounded-sm bg-background px-6 py-3 text-sm font-medium text-foreground"
          >
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#pricing" className="rounded-sm border border-background/30 px-6 py-3 text-sm">
            See pricing
          </a>
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
          <img src="/logo.png" alt="Logo" className="h-12 w-auto" />
        </div>
        <div className="font-mono text-xs text-muted-foreground">© {new Date().getFullYear()}. All rights reserved.</div>
      </div>
    </footer>
  );
}
