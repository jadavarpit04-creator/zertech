"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/auth");
      return;
    }
    // Always send new sign-ups to onboarding (they can skip it)
    router.replace("/onboarding");
  }, [session, isPending, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mono-caps text-muted-foreground">Zertech</div>
        <h1 className="mt-2 font-mono text-2xl font-bold">Signing you in…</h1>
      </div>
    </div>
  );
}
