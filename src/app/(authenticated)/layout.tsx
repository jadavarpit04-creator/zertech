'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { AppShell } from "@/components/app-shell";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [initialCheck, setInitialCheck] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth");
    } else if (!isPending && session) {
      setInitialCheck(true);
    }
  }, [session, isPending, router]);

  if (!initialCheck) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
