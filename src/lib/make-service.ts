// Make.com webhook notification service
// Sends events to Make.com so scenarios can react to Zertech events.

const GLOBAL_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

export interface MakeEvent {
  trigger: "draft.created" | "invoice.overdue" | "draft.sent" | "lead.new" | "custom";
  payload: Record<string, any>;
}

/**
 * Send an event to Make.com webhook.
 * Uses a per-user webhook URL if provided, otherwise falls back to the global env var.
 * Silently fails if no webhook URL is configured or the request fails.
 */
export async function sendMakeEvent(event: MakeEvent, webhookUrl?: string): Promise<void> {
  const url = webhookUrl || GLOBAL_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (e: any) {
    console.error("[Make.com] Failed to send event:", e.message);
  }
}
