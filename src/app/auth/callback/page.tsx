"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, isLoaded } = useSession();

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    const createdAt = user.createdAt ? new Date(user.createdAt).getTime() : Date.now();
    const isNewUser = Date.now() - createdAt < 60_000;
    router.replace(isNewUser ? "/onboarding" : "/dashboard");
  }, [isLoaded, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mono-caps text-muted-foreground">Zertech</div>
        <h1 className="mt-2 font-mono text-2xl font-bold">Signing you in…</h1>
      </div>
    </div>
  );
}
