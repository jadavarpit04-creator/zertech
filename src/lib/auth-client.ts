"use client";

import { useEffect, useState } from "react";

type SessionUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  createdAt: string;
  profile: Record<string, any> | null;
} | null;

export function useSession(): { user: SessionUser; isLoaded: boolean } {
  const [user, setUser] = useState<SessionUser>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user ?? null);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setIsLoaded(true));
  }, []);

  return { user, isLoaded };
}
