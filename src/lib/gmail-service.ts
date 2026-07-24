// Gmail API integration — direct REST calls (no googleapis dependency)
// Uses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from environment.
// Tokens are stored in the `integrations` Supabase table (token_data column).

const GMAIL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// ─── 1. Token refresh ──────────────────────────────────────

async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 3600,
  };
}

// ─── 2. Types ──────────────────────────────────────────────

interface GmailMessage {
  id: string;
  threadId: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: any[];
  };
  internalDate: string;
}

export interface EmailData {
  gmail_id: string;
  from: string;
  subject: string;
  body_snippet: string;
  has_attachments: boolean;
  received_at: string;
}

export interface DetectedInvoice extends EmailData {
  matchReason: string;
}

export interface DetectedLead extends EmailData {
  matchReason: string;
  score: number;
}

// ─── 3. Detect invoices ────────────────────────────────────

export function detectInvoices(emails: EmailData[]): DetectedInvoice[] {
  const invoiceKeywords = [
    "invoice",
    "overdue",
    "payment",
    "bill",
    "receipt",
    "due",
    "statement",
  ];

  return emails
    .filter((email) => {
      const subjectLower = email.subject.toLowerCase();
      const bodyLower = email.body_snippet.toLowerCase();
      return invoiceKeywords.some(
        (kw) => subjectLower.includes(kw) || bodyLower.includes(kw)
      );
    })
    .map((email) => ({
      ...email,
      matchReason: "keyword_match",
    }));
}

// ─── 4. Detect leads ───────────────────────────────────────

const leadKeywords = [
  "interested",
  "pricing",
  "quote",
  "demo",
  "consultation",
  "partnership",
  "services",
  "project",
  "collaboration",
  "website",
  "quote",
  "estimate",
];

export function detectLeads(emails: EmailData[]): DetectedLead[] {
  return emails
    .filter((email) => {
      const subjectLower = email.subject.toLowerCase();
      const bodyLower = email.body_snippet.toLowerCase();
      const matchCount = leadKeywords.filter(
        (kw) => subjectLower.includes(kw) || bodyLower.includes(kw)
      ).length;
      return matchCount >= 2;
    })
    .map((email) => ({
      ...email,
      matchReason: "lead_keyword_match",
      score: Math.min(
        leadKeywords.filter(
          (kw) =>
            email.subject.toLowerCase().includes(kw) ||
            email.body_snippet.toLowerCase().includes(kw)
        ).length * 20,
        100
      ),
    }));
}

// ─── 5. Sync emails from Gmail ─────────────────────────────

export async function syncEmails(
  accessToken: string,
  refreshToken: string | null,
  _userId: string
): Promise<EmailData[]> {
  const thirtyDaysAgo =
    Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

  // ── List messages ──
  const listRes = await fetch(
    `${GMAIL_API_BASE}/messages?q=after:${thirtyDaysAgo}&maxResults=5`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  // Auto-refresh if token expired
  if (listRes.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken);
    return syncEmails(refreshed.accessToken, refreshToken, _userId);
  }

  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Failed to list messages: ${err}`);
  }

  const listData = await listRes.json();
  const messages: Array<{ id: string; threadId: string }> =
    listData.messages ?? [];

  // ── Fetch full message details in batches ──
  const emails: EmailData[] = [];
  const batchSize = 5;

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const details = await Promise.all(
      batch.map((msg) =>
        fetch(`${GMAIL_API_BASE}/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json())
      )
    );

    for (const detail of details) {
      if (detail.error) continue;
      const email = parseGmailMessage(detail as GmailMessage);
      if (email) emails.push(email);
    }
  }

  return emails;
}

// ─── 6. Message parser ─────────────────────────────────────

function parseGmailMessage(msg: GmailMessage): EmailData | null {
  if (!msg?.payload?.headers) return null;

  const headers = msg.payload.headers;
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
      ?.value ?? "";

  const from = getHeader("From");
  const subject = getHeader("Subject");
  if (!from && !subject) return null;

  return {
    gmail_id: msg.id,
    from,
    subject,
    body_snippet: extractSnippet(msg),
    has_attachments: false,
    received_at: new Date(Number(msg.internalDate)).toISOString(),
  };
}

// ─── 7. Snippet extractor ──────────────────────────────────

function extractSnippet(msg: GmailMessage): string {
  // Try top-level snippet first
  const snippet = (msg as any).snippet;
  if (snippet) return snippet;

  // Walk parts
  const parts = msg.payload.parts ?? [];
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64").toString("utf-8").slice(0, 500);
    }
    if (part.mimeType === "text/html" && part.body?.data) {
      const html = Buffer.from(part.body.data, "base64").toString("utf-8");
      return html.replace(/<[^>]+>/g, "").slice(0, 500);
    }
  }

  return "";
}
