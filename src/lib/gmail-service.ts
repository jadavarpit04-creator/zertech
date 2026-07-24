// Gmail API integration — direct REST calls (no googleapis dependency)
// Uses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from environment.
// Tokens are stored in the `integrations` Supabase table (token_data column).

const GMAIL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface GmailTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    filename: string;
    headers: Array<{ name: string; value: string }>;
    mimeType: string;
    parts?: Array<{
      filename: string;
      mimeType: string;
      body: { size: number; attachmentId?: string };
    }>;
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

// â”€â”€â”€ 1. OAuth URL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Generate the Google OAuth consent URL for Gmail scopes.
 * The frontend should redirect the user to this URL.
 * Stores GOOGLE_CLIENT_ID from env; throws if unset.
 */
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

// â”€â”€â”€ 2. Token exchange â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Exchange the authorization code for access + refresh tokens.
 * @returns accessToken, refreshToken (may be null), and expiryDate (epoch ms).
 */
export async function handleGmailCallback(
  code: string,
  origin?: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }

  const baseUrl = origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080";
  const redirectUri = `${baseUrl}/api/gmail/callback`;

  const res = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data: GmailTokenResponse = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiryDate: Date.now() + data.expires_in * 1000,
  };
}

// â”€â”€â”€ 3. Token refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiryDate: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }

  const res = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data: GmailTokenResponse = await res.json();
  return {
    accessToken: data.access_token,
    expiryDate: Date.now() + data.expires_in * 1000,
  };
}

// â”€â”€â”€ 4. Email sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Fetch emails from the last 30 days via Gmail API.
 * Automatically refreshes the access token on 401.
 * Batches message detail fetches in groups of 10.
 */
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

  // â”€â”€ Fetch full message details in batches â”€â”€
  const emails: EmailData[] = [];
  const batchSize = 10;

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

// â”€â”€â”€ 5. Message parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    body_snippet: msg.snippet ?? "",
    has_attachments: hasAttachment(msg.payload),
    received_at: new Date(parseInt(msg.internalDate)).toISOString(),
  };
}

function hasAttachment(payload: GmailMessage["payload"]): boolean {
  if (!payload) return false;
  // Direct attachment on the message itself
  if (payload.filename && payload.filename.length > 0) return true;
  // Multipart message — check each part for a filename
  if (payload.parts) {
    return payload.parts.some((p) => p.filename && p.filename.length > 0);
  }
  return false;
}

// â”€â”€â”€ 8. Send email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface SendOptions {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

/**
 * Send an email via the Gmail API using RFC 2822 raw message.
 * Auto-refreshes the access token on 401.
 */
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

// â”€â”€â”€ 9. Invoice detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Scan emails for invoice-related content.
 * Matches subjects containing: invoice, overdue, payment, bill,
 * receipt, due, statement. Also flags emails with attachments.
 */
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

  const results: DetectedInvoice[] = [];

  for (const email of emails) {
    const subjectLower = email.subject.toLowerCase();
    const bodyLower = (email.body_snippet || "").toLowerCase();
    const combined = subjectLower + " " + bodyLower;

    const match = invoiceKeywords.find((kw) => combined.includes(kw));
    if (match) {
      results.push({ ...email, matchReason: `Subject/body contains "${match}"` });
      continue;
    }

    if (email.has_attachments) {
      results.push({ ...email, matchReason: "Has attachment(s)" });
    }
  }

  return results;
}

// â”€â”€â”€ 7. Lead detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Scan emails for lead-related content.
 * Matches subjects containing: inquiry, quote, proposal, pricing,
 * demo, meeting, partnership, collaboration, estimate, consultation.
 * Scores 1–5 based on intent keywords and attachment presence.
 */
export function detectLeads(emails: EmailData[]): DetectedLead[] {
  const leadKeywords = [
    "inquiry",
    "quote",
    "proposal",
    "pricing",
    "demo",
    "meeting",
    "partnership",
    "collaboration",
    "estimate",
    "consultation",
  ];

  const highIntentKeywords = [
    "interested",
    "looking for",
    "need",
    "budget",
    "timeline",
    "start date",
    "sign",
    "contract",
    "purchase",
    "buy",
  ];

  const lowIntentKeywords = [
    "newsletter",
    "unsubscribe",
    "spam",
    "job",
    "application",
  ];

  const results: DetectedLead[] = [];

  for (const email of emails) {
    const subjectLower = email.subject.toLowerCase();
    const bodyLower = email.body_snippet.toLowerCase();

    const leadMatch = leadKeywords.find((kw) => subjectLower.includes(kw));
    if (!leadMatch) continue;

    let score = 3; // neutral base

    if (
      highIntentKeywords.some(
        (kw) => subjectLower.includes(kw) || bodyLower.includes(kw)
      )
    ) {
      score += 2;
    }

    if (
      lowIntentKeywords.some(
        (kw) => subjectLower.includes(kw) || bodyLower.includes(kw)
      )
    ) {
      score -= 1;
    }

    if (email.has_attachments) score += 1;

    results.push({
      ...email,
      matchReason: `Subject matches "${leadMatch}"`,
      score: Math.max(1, Math.min(5, score)),
    });
  }

  return results;
}
