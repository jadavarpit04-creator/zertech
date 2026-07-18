"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const TEAM_SIZES: Array<{ value: string; label: string; sub: string }> = [
  { value: "1 (Solo)", label: "1", sub: "Solo" },
  { value: "2-5", label: "2-5", sub: "Small" },
  { value: "6-10", label: "6-10", sub: "Growing" },
  { value: "11-25", label: "11-25", sub: "Team" },
  { value: "26-50", label: "26-50", sub: "Scale" },
  { value: "50+", label: "50+", sub: "Enterprise" },
];

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "signup") setMode("signup");
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        handlePostAuthRedirect(data.session.user);
      }
    });
  }, [router]);

  const handlePostAuthRedirect = async (user: any) => {
    // New users (created in the last 2 min) go to onboarding; everyone else to dashboard.
    const isNewUser =
      user.created_at &&
      Date.now() - new Date(user.created_at).getTime() < 120000;

    if (isNewUser) {
      router.push("/onboarding");
    } else {
      router.push("/dashboard");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!teamSize) {
          toast.error("Please select your team size");
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, company, team_size: teamSize },
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to verify.");
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth",
      },
    });
    if (error) {
      toast.error(error.message ?? "Google sign-in failed");
      setBusy(false);
      return;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <img src="/logo.png" alt="Logo" className="h-24 w-auto" />
        </Link>
        <div className="rounded-sm border border-border bg-card p-8">
          <div className="mono-caps text-muted-foreground">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </div>
          <h1 className="mt-2 font-mono text-2xl font-bold">
            {mode === "signin" ? "Sign in" : "Get started"}
          </h1>

          <button
            onClick={google}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-sm border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="mono-caps text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mono-caps mb-2 block text-muted-foreground">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                  required
                />
              </div>
            )}
            {mode === "signup" && (
              <div>
                <label className="mono-caps mb-2 block text-muted-foreground">Company name</label>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                  required
                />
              </div>
            )}
            {mode === "signup" && (
              <div>
                <label className="mono-caps mb-2 block text-muted-foreground">Team size</label>
                <div className="grid grid-cols-3 gap-2">
                  {TEAM_SIZES.map((s) => {
                    const active = teamSize === s.value;
                    return (
                      <button
                        type="button"
                        key={s.value}
                        onClick={() => setTeamSize(s.value)}
                        className={
                          "flex flex-col items-center justify-center rounded-sm border px-2 py-2.5 text-center transition " +
                          (active
                            ? "border-foreground bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-muted")
                        }
                      >
                        <span className="text-sm font-semibold leading-none">{s.label}</span>
                        <span
                          className={
                            "mt-1 text-[10px] leading-none " +
                            (active ? "text-primary-foreground/70" : "text-muted-foreground")
                          }
                        >
                          {s.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <input type="hidden" value={teamSize} required />
              </div>
            )}
            <div>
              <label className="mono-caps mb-2 block text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                required
              />
            </div>
            <div>
              <label className="mono-caps mb-2 block text-muted-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "No account?" : "Have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-foreground underline underline-offset-4"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
