// Gmail API integration — direct REST calls (no googleapis dependency)
// Uses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from environment.
// Tokens are stored in the `integrations` Supabase table (token_data column).

const GMAIL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.labels",
];

// ─── 1. OAuth helpers ──────────────────────────────────────

export function initGmailOAuth(origin?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not set");
  }

  const baseUrl = origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080";
  const redirectUri = `${baseUrl}/api/gmail/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return `${GMAIL_AUTH_URL}?${params.toString()}`;
}

export async function handleGmailCallback(
  code: string,
  origin?: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email?: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const baseUrl = origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080";
  const redirectUri = `${baseUrl}/api/gmail/callback`;

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await res.json();

  let email: string | undefined;
  try {
    const profileRes = await fetch(`${GMAIL_API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      email = profile.emailAddress;
    }
  } catch {}

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
    email: email || data.email || undefined,
  };
}

// ─── 2. Token refresh ──────────────────────────────────────

export async function refreshAccessToken(
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

// ─── 3. Types ──────────────────────────────────────────────

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

interface SendOptions {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

// ─── 4. Detect invoices ────────────────────────────────────

export function detectInvoices(emails: EmailData[]): DetectedInvoice[] {
  const invoiceKeywords = [
    "invoice", "overdue", "payment", "bill", "receipt", "due", "statement",
  ];
  return emails
    .filter((email) => {
      const subjectLower = email.subject.toLowerCase();
      const bodyLower = email.body_snippet.toLowerCase();
      return invoiceKeywords.some(
        (kw) => subjectLower.includes(kw) || bodyLower.includes(kw)
      );
    })
    .map((email) => ({ ...email, matchReason: "keyword_match" }));
}

// ─── 5. Detect leads ───────────────────────────────────────

const leadKeywords = [
  "interested", "pricing", "quote", "demo", "consultation",
  "partnership", "services", "project", "collaboration", "website", "estimate",
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

// ─── 6. Sync emails from Gmail ─────────────────────────────

export async function syncEmails(
  accessToken: string,
  refreshToken: string | null,
  _userId: string
): Promise<EmailData[]> {
  const thirtyDaysAgo =
    Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

  const listRes = await fetch(
    `${GMAIL_API_BASE}/messages?q=after:${thirtyDaysAgo}&maxResults=5`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

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

// ─── 7. Send email ─────────────────────────────────────────

export async function sendEmail(
  accessToken: string,
  refreshToken: string | null,
  opts: SendOptions
): Promise<{ id: string }> {
  const email = [
    `To: ${opts.to}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    `Subject: ${opts.subject}`,
    "",
    opts.body,
  ].join("\n");

  const raw = Buffer.from(email).toString("base64url");

  const send = async (token: string) =>
    fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw, threadId: opts.threadId }),
    });

  let res = await send(accessToken);

  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken);
    res = await send(refreshed.accessToken);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to send email: ${err}`);
  }

  const data = await res.json();
  return { id: data.id };
}

// ─── 8. Message parser ─────────────────────────────────────

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

// ─── 9. Snippet extractor ──────────────────────────────────

function extractSnippet(msg: GmailMessage): string {
  const snippet = (msg as any).snippet;
  if (snippet) return snippet;

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
