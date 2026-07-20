// AI-powered draft generation service with 3-tone support and template fallback
// Supports NVIDIA NIM (Llama 3.1 Nemotron) via its REST API

export type Tone = "friendly" | "professional" | "firm";

export interface InvoiceData {
  client_name: string;
  amount: number;
  due_date: string;
  days_overdue: number;
  invoice_id?: string;
}

export interface LeadData {
  lead_name: string;
  source?: string;
  notes?: string;
}

export interface DraftResult {
  subject: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Escalation logic
// ---------------------------------------------------------------------------

/**
 * Determine the appropriate tone based on days overdue.
 *   1st reminder (≤7 days): friendly
 *   2nd reminder (≤14 days): professional
 *   3rd reminder (30+ days): firm + final notice
 */
export function getEscalationTone(days_overdue: number): Tone {
  if (days_overdue >= 30) return "firm";
  if (days_overdue >= 14) return "professional";
  return "friendly";
}

/**
 * Get the escalation stage label for display / inclusion in the draft body.
 */
export function getEscalationLabel(days_overdue: number): string {
  if (days_overdue >= 30) return "Final Notice — ";
  if (days_overdue >= 14) return "Second Reminder — ";
  return "Reminder — ";
}

// ---------------------------------------------------------------------------
// Template fallbacks (used when AI API is unavailable)
// ---------------------------------------------------------------------------

function invoiceTemplate(
  tone: Tone,
  data: InvoiceData
): DraftResult {
  const { client_name, amount, due_date, days_overdue, invoice_id } = data;
  const invRef = invoice_id ?? `INV-${Math.floor(Math.random() * 10000)}`;
  const formattedAmount = `$${amount.toFixed(2)}`;
  const via = getEscalationLabel(days_overdue);

  switch (tone) {
    case "friendly": {
      const subject = `Quick reminder: Invoice ${invRef} for ${formattedAmount}`;
      const body = [
        `Hi ${client_name},`,
        ``,
        `Just a quick reminder that invoice ${invRef} for ${formattedAmount} was due on ${due_date} and is now ${days_overdue} day${days_overdue === 1 ? "" : "s"} overdue.`,
        ``,
        `You can pay here: {{payment_link}}

If you have any questions or need to set up a payment plan, just let me know.`,
        ``,
        `Thanks for your time,`,
        ``,
      ].join("\n");
      return { subject, body };
    }

    case "professional": {
      const subject = `Reminder: Invoice ${invRef} — ${formattedAmount} overdue`;
      const body = [
        `Dear ${client_name},`,
        ``,
        `This is a reminder regarding invoice ${invRef} for ${formattedAmount}, which was due on ${due_date} and is now ${days_overdue} days past due.`,
        ``,
        `We kindly request that payment be remitted at your earliest convenience.

Pay here: {{payment_link}}

If you have already sent payment, please disregard this notice.`,
        ``,
        `If there are any questions or concerns regarding this invoice, please contact us directly.`,
        ``,
        `Sincerely,`,
        ``,
      ].join("\n");
      return { subject, body };
    }

    case "firm": {
      const subject = `FINAL NOTICE: Invoice ${invRef} — ${formattedAmount} overdue`;
      const body = [
        `URGENT — Attention ${client_name},`,
        ``,
        `This is a FINAL NOTICE for invoice ${invRef} for ${formattedAmount}, which was due on ${due_date} and is now ${days_overdue} days past due.`,
        ``,
        `Immediate payment is required to avoid any further escalation.

Pay immediately: {{payment_link}}

If you believe there has been an error, contact us immediately.`,
        ``,
        `Please remit payment in full today. If you believe there has been an error, contact us immediately.`,
        ``,
        `Final Notice,`,
        ``,
      ].join("\n");
      return { subject, body };
    }
  }
}

function leadTemplate(tone: Tone, data: LeadData): DraftResult {
  const { lead_name, source, notes } = data;
  const firstName = lead_name.split(" ")[0];

  switch (tone) {
    case "friendly": {
      const subject = `Thanks for reaching out, ${firstName}!`;
      const body = [
        `Hi ${lead_name},`,
        ``,
        `Thanks so much for getting in touch${source ? ` via ${source}` : ""}! I really appreciate it.`,
        notes ? `I see you mentioned: ${notes} — sounds interesting!` : `I'd love to learn more about what you're working on.`,
        ``,
        `Do you have time for a quick call this week? Let me know what works best for you.`,
        ``,
        `Looking forward to connecting,`,
        ``,
      ].join("\n");
      return { subject, body };
    }

    case "professional": {
      const subject = `Thank you for your inquiry, ${firstName}`;
      const body = [
        `Dear ${lead_name},`,
        ``,
        `Thank you for reaching out${source ? ` via ${source}` : ""}.`,
        notes ? `We received your note: "${notes}" and would be pleased to discuss this further.` : `We appreciate your interest in our services.`,
        ``,
        `We would welcome the opportunity to schedule a brief call to better understand your needs. Please let us know your availability.`,
        ``,
        `We look forward to speaking with you.`,
        ``,
        `Sincerely,`,
        ``,
      ].join("\n");
      return { subject, body };
    }

    case "firm": {
      const subject = `Follow-up regarding your inquiry, ${firstName}`;
      const body = [
        `Dear ${lead_name},`,
        ``,
        `We recently received your inquiry${source ? ` through ${source}` : ""} and would like to follow up promptly.`,
        notes ? `Regarding your note: "${notes}" — we are prepared to move forward and would appreciate a timely response.` : `We are ready to discuss how we can assist you and request a response at your earliest convenience.`,
        ``,
        `Please reply to confirm a time to speak, or let us know if your needs have changed.`,
        ``,
        `We look forward to your response.`,
        ``,
        `Best regards,`,
        ``,
      ].join("\n");
      return { subject, body };
    }
  }
}

// ---------------------------------------------------------------------------
// AI API calls
// ---------------------------------------------------------------------------

async function callAI(prompt: string): Promise<string | null> {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey) {
    return callNVIDIA(nvidiaKey, prompt);
  }
  return null;
}

// Generic chat completion for the AI assistant widget.
export type ChatResult = { reply: string; mode: "live" | "demo" };

const CHAT_SYSTEM = `You are Zertech Assistant, an AI helper for Zertech — an AI-powered B2B assistant that automates invoice reminders and lead follow-ups for agencies, freelancers, and SaaS companies.

Be concise, friendly, and helpful. Answer questions about:
- Features & how it works (connect Gmail, AI finds opportunities, you approve & send)
- Pricing (Starter ₹2,499/$49, Growth ₹7,499/$149, Pro ₹14,999/$299 — all with a 14-day free trial)
- Getting started, integrations (Gmail, Outlook, Google Sheets, Slack, Telegram), lead scoring, escalation
- Contact: hello@zertech.app

Rules:
- Keep replies under 120 words.
- Plain text only. Do NOT use markdown, asterisks, or bold syntax.
- If asked about something unrelated to Zertech, politely say you can only help with Zertech.
- End with a short question or next step when useful.`;

export async function chatWithAI(messages: { role: "user" | "assistant" | "system"; content: string }[]): Promise<ChatResult> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const orBase = process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1";
  const orModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const orHeavy = process.env.OPENROUTER_HEAVY_MODEL || "google/gemini-2.5-flash";
  const nvBase = process.env.NVIDIA_API_BASE || "https://integrate.api.nvidia.com/v1";
  const nvModel = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";

  const fullMessages = [{ role: "system" as const, content: CHAT_SYSTEM }, ...messages];

  // Route heavy prompts (long / detail / compare / explain) to the stronger model.
  const last = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
  const isHeavy = last.length > 90 || /\b(explain|how does|compare|comparison|detail|walk me through|step by step|difference|vs|versus|pros and cons)\b/i.test(last);
  const orChosen = isHeavy ? orHeavy : orModel;

  // Primary: OpenRouter (fast model, heavy→strong model). Fallback: NVIDIA. Else: demo.
  if (openrouterKey) {
    const r = await chatOpenRouter(openrouterKey, orBase, orChosen, fullMessages);
    if (r) return { reply: r, mode: "live" };
  }
  if (nvidiaKey) {
    const r = await chatNVIDIA(nvidiaKey, nvBase, nvModel, fullMessages);
    if (r) return { reply: r, mode: "live" };
  }
  // No valid key — graceful demo fallback that still feels helpful.
  return { reply: fallbackReply(messages), mode: "demo" };
}

const ZERTECH_TOPICS = [
  "invoice", "reminder", "follow", "lead", "pricing", "price", "plan", "trial",
  "gmail", "outlook", "email", "sheet", "export", "csv", "ai", "draft", "approve",
  "automation", "agency", "freelanc", "saas", "zertech", "service", "website",
  "seo", "onboard", "connect", "schedule", "scor", "escalat", "cancel", "refund",
  "money", "save", "paid", "payment", "bill", "subscription", "demo", "contact",
  "setup", "feature", "integration", "slack", "telegram", "notification",
];

function fallbackReply(messages: { role: "user" | "assistant" | "system"; content: string }[]): string {
  const last = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
  const isZertech = ZERTECH_TOPICS.some((t) => last.includes(t));

  if (!isZertech) {
    return "Sorry, I can only help with Zertech — invoice reminders, lead follow-ups, pricing, and getting started. Try one of the suggestions below! 👇";
  }
  if (last.includes("price") || last.includes("pricing") || last.includes("plan") || last.includes("subscription") || last.includes("bill")) {
    return "Zertech has 3 plans: Starter ₹2,499/$49, Growth ₹7,499/$149, and Pro ₹14,999/$299 per month. All include a 14-day free trial. Want help picking one?";
  }
  if (last.includes("save") || last.includes("money") || last.includes("paid") || last.includes("payment") || last.includes("refund")) {
    return "Zertech helps you save money by auto-drafting invoice reminders so you actually get paid on time — and by catching leads before they go cold. Agencies typically recover far more in late invoices than the plan costs. Want to see the pricing?";
  }
  if (last.includes("contact") || last.includes("demo")) {
    return "You can reach us at hello@zertech.app or book a demo from the dashboard. We typically reply within a few hours.";
  }
  if (last.includes("service") || last.includes("website") || last.includes("seo") || last.includes("feature") || last.includes("onboard") || last.includes("setup") || last.includes("connect") || last.includes("how")) {
    return "Zertech automates invoice reminders and lead follow-ups. Connect your Gmail, and our AI drafts personalized follow-ups for you to approve and send. Want me to walk you through setup?";
  }
  return "I'm Zertech Assistant 👋. I can help with features, pricing, or getting started. Try the quick suggestions below!";
}

async function chatNVIDIA(
  apiKey: string,
  base: string,
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 45000);
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: 200 }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

async function chatOpenRouter(
  apiKey: string,
  base: string,
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: 200 }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

async function callNVIDIA(apiKey: string, prompt: string): Promise<string | null> {
  const base = process.env.NVIDIA_API_BASE || "https://integrate.api.nvidia.com/v1";
  const model = process.env.NVIDIA_MODEL || "nvidia/llama-3.1-nemotron-70b-instruct";
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a professional business correspondence assistant. Generate concise, well-formatted email drafts. Return ONLY a JSON object with \"subject\" and \"body\" fields. Do not include markdown fences or extra text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 512,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      console.warn("[ai-service] NVIDIA API error:", res.status, errText);
      return null;
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    return content.trim();
  } catch (err) {
    console.warn("[ai-service] NVIDIA request failed:", err);
    return null;
  }
}

function parseAIResponse(
  raw: string
): { subject: string; body: string } | null {
  try {
    // Try direct JSON parse
    const parsed = JSON.parse(raw);
    if (parsed.subject && parsed.body) {
      return { subject: parsed.subject, body: parsed.body };
    }
  } catch {
    // If the model didn't return clean JSON, try to extract
    const subMatch = raw.match(/"subject"\s*:\s*"([^"]+)"/);
    const bodyMatch = raw.match(/"body"\s*:\s*"([^"]+)"/);
    if (subMatch && bodyMatch) {
      return { subject: subMatch[1], body: bodyMatch[1] };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Invoice draft generation
// ---------------------------------------------------------------------------

export async function generateInvoiceDraft(
  tone: Tone,
  data: InvoiceData
): Promise<DraftResult> {
  const { client_name, amount, due_date, days_overdue, invoice_id } = data;
  const invRef = invoice_id ?? `INV-${Math.floor(Math.random() * 10000)}`;
  const formattedAmount = `$${amount.toFixed(2)}`;
  const label = getEscalationLabel(days_overdue);

  // Try AI first
  const prompt = [
    `Generate a ${tone}-toned invoice reminder email draft for a client named "${client_name}".`,
    `Invoice reference: ${invRef}`,
    `Amount: ${formattedAmount}`,
    `Due date: ${due_date}`,
    `Days overdue: ${days_overdue}`,
    `Include the escalation label "${label}" if appropriate.`,
    `Include a payment link placeholder {{payment_link}} in the body. Respond with a JSON object containing "subject" and "body".`,
  ].join("\n");

  const raw = await callAI(prompt);
  if (raw) {
    const parsed = parseAIResponse(raw);
    if (parsed) return parsed;
  }

  // Fallback to template
  return invoiceTemplate(tone, data);
}

// ---------------------------------------------------------------------------
// Lead draft generation
// ---------------------------------------------------------------------------

export async function generateLeadDraft(
  tone: Tone,
  data: LeadData
): Promise<DraftResult> {
  const { lead_name, source, notes } = data;

  // Try AI first
  const prompt = [
    `Generate a ${tone}-toned response email draft for a lead named "${lead_name}".`,
    source ? `Source: ${source}` : "",
    notes ? `Notes from the lead: "${notes}"` : "",
    `Respond with a JSON object containing "subject" and "body".`,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callAI(prompt);
  if (raw) {
    const parsed = parseAIResponse(raw);
    if (parsed) return parsed;
  }

  // Fallback to template
  return leadTemplate(tone, data);
}

// ---------------------------------------------------------------------------
// Unified generator (dispatches by kind)
// ---------------------------------------------------------------------------

export async function generateDraft(
  kind: "invoice" | "lead",
  tone: Tone,
  data: InvoiceData | LeadData
): Promise<DraftResult> {
  if (kind === "invoice") {
    return generateInvoiceDraft(tone, data as InvoiceData);
  }
  return generateLeadDraft(tone, data as LeadData);
}
