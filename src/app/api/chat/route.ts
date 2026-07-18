import { NextRequest, NextResponse } from "next/server";
import { chatWithAI, type ChatResult } from "@/lib/ai-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }
    // Hard cap so the client never hangs: if AI takes >48s, fall back to demo.
    const timeout = new Promise<ChatResult>((resolve) => {
      setTimeout(() => resolve({ reply: fallbackHint(), mode: "demo" }), 48000);
    });
    const result = await Promise.race([chatWithAI(messages), timeout]);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[api/chat]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error", reply: "Sorry, something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

function fallbackHint(): string {
  return "I'm a bit slow to respond right now. Try asking about Zertech's pricing, features, or how to get started — or pick a quick option below. 👇";
}
