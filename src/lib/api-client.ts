// Client-side wrapper for the API route /api/fn
// Mirrors the old useServerFn pattern but uses plain fetch

async function call<T = any>(fn: string, data?: any): Promise<T> {
  const res = await fetch("/api/fn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fn, data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

// ---------- Invoices ----------
export function listInvoices() {
  return call<any[]>("listInvoices");
}
export function importInvoices(data: { rows: Array<{ client_name: string; client_email: string; amount: number; due_date: string }> }) {
  return call<{ count: number }>("importInvoices", data);
}
export function runInvoiceScan() {
  return call<{ created: number; overdue: number }>("runInvoiceScan");
}

// ---------- Leads ----------
export function listLeads() {
  return call<any[]>("listLeads");
}
export function importLeads(data: { rows: Array<{ name: string; email: string; source?: string; notes?: string }> }) {
  return call<{ count: number }>("importLeads", data);
}

// ---------- Drafts ----------
export function listPendingDrafts() {
  return call<any[]>("listPendingDrafts");
}

export type DraftTone = "friendly" | "professional" | "firm";
export type DraftKind = "invoice" | "lead";

export async function generateDraft(
  kind: DraftKind,
  tone: DraftTone,
  data: Record<string, any>
): Promise<{ subject: string; body: string }> {
  const res = await fetch("/api/ai/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, tone, data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Draft generation failed");
  }
  return res.json();
}
export function updateDraft(data: { id: string; subject: string; body: string }) {
  return call<{ ok: boolean }>("updateDraft", data);
}
export function sendDraft(data: { id: string }) {
  return call<{ ok: boolean }>("sendDraft", data);
}
export function discardDraft(data: { id: string }) {
  return call<{ ok: boolean }>("discardDraft", data);
}

// ---------- History ----------
export function listActivity() {
  return call<any[]>("listActivity");
}

// ---------- Dashboard ----------
export function dashboardSummary() {
  return call<{
    pending: number;
    sent: number;
    sentToday: number;
    overdue: number;
    newLeads: number;
    recent: any[];
    recoveredAmount: number;
    avgResponseTime: number;
  }>("dashboardSummary");
}

// ---------- Settings ----------
export function listSettings() {
  return call<{ workflows: any[]; integrations: any[] }>("listSettings");
}
export function updateWorkflow(data: { workflow: "invoice" | "lead"; auto_send: boolean }) {
  return call<{ ok: boolean }>("updateWorkflow", data);
}
export function toggleIntegration(data: { provider: "gmail" | "sheets" | "outlook" | "slack"; connected: boolean }) {
  return call<{ ok: boolean }>("toggleIntegration", data);
}
export function saveIntegrationMeta(data: { provider: "gmail" | "sheets" | "outlook" | "slack"; meta: Record<string, any> }) {
  return call<{ ok: boolean }>("saveIntegrationMeta", data);
}
export function reportsSummary(period: "30d" | "90d" | "year" = "30d") {
  return call<{
    period: string;
    invoicesDetected: number;
    remindersSent: number;
    paidAfterReminder: number;
    recoveryRate: number;
    recoveredAmount: number;
    leadsReceived: number;
    leadsContacted: number;
    responseImprovement: string;
    recoveryTrend: Array<{ date: string; count: number }>;
  }>("reportsSummary", { period });
}
export function listTemplates() {
  return call<any[]>("listTemplates");
}
export function listArchivedDrafts() {
  return call<any[]>("listArchivedDrafts");
}
export function listScheduledDrafts() {
  return call<any[]>("listScheduledDrafts");
}
export function saveTemplate(data: { id?: string; kind: "invoice" | "lead"; name: string; subject: string; body: string }) {
  return call<{ ok: boolean }>("saveTemplate", data);
}
export function getProfile() {
  return call<{ id: string; full_name: string; company: string; team_size?: string }>("getProfile");
}
export function updateProfile(data: { full_name?: string; company?: string; team_size?: string }) {
  return call<{ ok: boolean }>("updateProfile", data);
}
export function setPlan(plan: "starter" | "growth" | "pro") {
  return call<{ ok: boolean }>("setPlan", { plan });
}

// ---------- New P1 features ----------
export function exportData(type: "invoices" | "leads" | "history") {
  return call<any[]>("exportData", { type });
}
export function bulkApprove(ids: string[]) {
  return call<{ ok: boolean; count: number }>("bulkApprove", { ids });
}
export function scheduleDraft(data: { id: string; scheduled_for: string }) {
  return call<{ ok: boolean }>("scheduleDraft", data);
}
// ---------- Gmail OAuth ----------
/**
 * Fetch the Google OAuth consent URL for Gmail.
 * The frontend should redirect the user to the returned url.
 */
export async function getGmailOAuthUrl(): Promise<string> {
  const res = await fetch("/api/gmail");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Failed to get Gmail OAuth URL");
  }
  const data = await res.json();
  return data.url;
}

// ---------- Sheets OAuth ----------
/**
 * Fetch the Google OAuth consent URL for Sheets.
 * The frontend should redirect the user to the returned url.
 */
export async function getSheetsOAuthUrl(): Promise<string> {
  const res = await fetch("/api/sheets");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Failed to get Sheets OAuth URL");
  }
  const data = await res.json();
  return data.url;
}

// ---------- OAuth callbacks ----------
/**
 * Exchange a Gmail OAuth code for tokens via the callback route.
 */
export async function gmailCallback(code: string): Promise<{ ok: boolean }> {
  const res = await fetch("/api/gmail/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Gmail callback failed");
  }
  return res.json();
}

/**
 * Exchange a Sheets OAuth code for tokens via the connect action.
 */
export async function sheetsCallback(code: string): Promise<{ ok: boolean }> {
  const res = await fetch("/api/sheets?action=connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Sheets callback failed");
  }
  return res.json();
}

/**
 * Trigger a Gmail email sync for the current user.
 */
export async function syncGmail(): Promise<{
  synced: number;
  invoicesFound: number;
  leadsFound: number;
}> {
  const res = await fetch("/api/gmail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sync" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Gmail sync failed");
  }
  return res.json();
}
