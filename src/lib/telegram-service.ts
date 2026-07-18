// Telegram bot notification service
// Sends alerts via Telegram Bot API when new drafts arrive

export async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    if (!res.ok) throw new Error(`Telegram API responded ${res.status}`);
    return { ok: true };
  } catch (err: any) {
    console.error("[Telegram]", err.message);
    return { ok: false, error: err.message };
  }
}

export function formatDraftMessage(draft: {
  kind: string;
  recipient_name: string;
  amount?: number;
  subject: string;
  id: string;
}) {
  const emoji = draft.kind === "invoice" ? "📄" : "📨";
  return [
    `${emoji} *New ${draft.kind} draft*`,
    `*${draft.subject}*`,
    draft.kind === "invoice"
      ? `Client: ${draft.recipient_name} — $${draft.amount ?? 0}`
      : `Lead: ${draft.recipient_name}`,
    `Review → ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080"}/approvals`,
  ].join("\n");
}
