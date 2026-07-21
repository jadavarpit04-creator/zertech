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
    // Check if user is new — hit a lightweight endpoint
    fetch("/api/user/check-new")
      .then((r) => r.json())
      .then((data) => {
        router.replace(data.isNew ? "/onboarding" : "/dashboard");
      })
      .catch(() => {
        router.replace("/dashboard");
      });
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
