// Slack webhook notification service
// Sends alerts to a Slack channel when new drafts arrive

export async function sendSlackNotification(webhookUrl: string, message: {
  text: string;
  attachments?: Array<{
    color?: string;
    title?: string;
    text?: string;
    fields?: Array<{ title: string; value: string; short?: boolean }>;
  }>;
}) {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!res.ok) throw new Error(`Slack webhook responded ${res.status}`);
    return { ok: true };
  } catch (err: any) {
    console.error("[Slack]", err.message);
    return { ok: false, error: err.message };
  }
}

export function newDraftAlert(draft: {
  kind: string;
  recipient_name: string;
  amount?: number;
  subject: string;
}) {
  const isInvoice = draft.kind === "invoice";
  return {
    text: `New ${draft.kind} draft ready for review`,
    attachments: [
      {
        color: isInvoice ? "#e74c3c" : "#3498db",
        title: draft.subject,
        text: isInvoice
          ? `Invoice for ${draft.recipient_name} — $${draft.amount ?? 0}`
          : `Lead follow-up for ${draft.recipient_name}`,
        fields: [
          { title: "Type", value: draft.kind, short: true },
          { title: "Client", value: draft.recipient_name, short: true },
        ],
      },
    ],
  };
}
