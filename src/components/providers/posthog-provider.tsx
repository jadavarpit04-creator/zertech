import { PostHogProvider as PHProvider } from "posthog-js/react";
import posthog from "posthog-js";
import { useEffect } from "react";

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
    if (key && typeof window !== "undefined") {
      posthog.init(key, {
        api_host: host,
        person_profiles: "identified_only",
        capture_pageview: true,
        loaded: (ph) => {
          if (process.env.NODE_ENV === "development") ph.opt_out_capturing();
        },
      });
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
