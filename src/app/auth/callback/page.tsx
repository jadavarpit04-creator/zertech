"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    const isNewUser =
      user.createdAt &&
      Date.now() - new Date(user.createdAt).getTime() < 60_000;
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
