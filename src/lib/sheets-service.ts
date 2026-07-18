// Google Sheets API v4 via REST (no client library dependency)
// Reads GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from env

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

function getClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID environment variable is not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret)
    throw new Error("GOOGLE_CLIENT_SECRET environment variable is not set");
  return secret;
}

/**
 * Generate the OAuth consent URL for Google Sheets scope.
 * The caller provides the redirectUri (must match the one registered in Google Cloud Console).
 */
export function initSheetsOAuth(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function handleSheetsCallback(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string | null;
  expiry_date: number;
}> {
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OAuth token exchange failed: ${err}`);
  }
  const data = await resp.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? null,
    expiry_date:
      data.expiry_date ?? Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

/**
 * Append a single row to a Google Sheet (range Sheet1!A:F).
 * Columns: Date, Time, Client, Invoice #, Amount, Status
 */
export async function appendFollowUpRow(
  accessToken: string,
  spreadsheetId: string,
  data: {
    date: string;
    time: string;
    client: string;
    invoiceNumber: string;
    amount: string;
    status: string;
  }
): Promise<{ updates: unknown }> {
  const range = "Sheet1!A:F";
  const resp = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [
          [
            data.date,
            data.time,
            data.client,
            data.invoiceNumber,
            data.amount,
            data.status,
          ],
        ],
      }),
    }
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to append row to sheet: ${err}`);
  }
  return resp.json();
}

/**
 * Create a new Google Spreadsheet with the given title.
 * Returns the spreadsheet ID and URL.
 */
export async function createSheet(
  accessToken: string,
  spreadsheetTitle: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const resp = await fetch(SHEETS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: spreadsheetTitle },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to create spreadsheet: ${err}`);
  }
  const data = await resp.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
  };
}
