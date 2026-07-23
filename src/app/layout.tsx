import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import AIChatWidget from "@/components/ai-chat-widget";

export const metadata: Metadata = {
  title: "Zertech — AI Follow-up Automation",
  description:
    "Automate invoice reminders and lead follow-ups. Approve, edit, and send — never miss a follow-up again.",
  openGraph: {
    title: "Zertech",
    description:
      "Get paid faster and respond to leads sooner. AI drafts invoice reminders and lead replies you can approve in one click.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <AIChatWidget />
      </body>
    </html>
  );
}
