"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useSignIn, useSignUp, useUser, useClerk } from "@clerk/nextjs";

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
  const { signIn } = useSignIn();
  const { setActive } = useClerk();
  const { signUp } = useSignUp();
  const { user, isLoaded: userLoaded } = useUser();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Guards the "already logged in -> /dashboard" effect so it doesn't race with
  // an in-flight form submission (which performs its own explicit redirect).
  const submittingRef = useRef(false);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "signup") setMode("signup");
  }, []);

  useEffect(() => {
    // Only auto-redirect already-authenticated visitors who land on /auth
    // without an active submission in progress. Without this guard, a
    // successful signUp/signIn (which sets the session asynchronously) would
    // trigger this effect and client-navigate to /dashboard, racing -- and
    // sometimes cancelling -- the explicit window.location.href redirect below.
    if (submittingRef.current) return;
    if (userLoaded && user) {
      router.push("/dashboard");
    }
  }, [user, userLoaded, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    submittingRef.current = true;
    setError("");

    // Pull a human-readable message out of a Clerk error. Clerk rejects with
    // an object carrying an `errors[]` array of detailed per-field messages
    // (e.g. "Password has been found in an online data breach..."). The generic
    // `err.message` does not always surface those, so we extract them here.
    const clerkMessage = (err: unknown): string => {
      const e = err as { errors?: Array<{ long_message?: string; message?: string }> };
      if (e && Array.isArray(e.errors) && e.errors.length > 0) {
        const first = e.errors[0];
        return first?.long_message || first?.message || "Something went wrong.";
      }
      if (err instanceof Error && err.message) return err.message;
      return "Something went wrong. Please try again.";
    };

    // Centralised hard navigation. Using window.location.href (not the Next
    // router) so the browser does a full reload and Clerk re-initialises with
    // the fresh session cookie -- client-side router.push races with the
    // authenticated route guard and can bounce the user back to /auth.
    const go = (path: string) => {
      window.location.href = path;
    };

    try {
      if (mode === "signup") {
        if (!teamSize) {
          setError("Please select your team size");
          return;
        }
        if (!signUp) {
          setError("Still loading -- please try again in a moment.");
          return;
        }

        const result: any = await signUp.create({
          emailAddress: email,
          password,
          firstName: fullName,
        });

        // The Clerk dev instance creates the session server-side on a
        // successful signup, but the result object returned by the `useSignUp`
        // hook sometimes reports status !== "complete" and createdSessionId as
        // null even though a session exists. We therefore detect completion
        // from EITHER the result OR the live client state, and pull the session
        // id from whichever source has it. Without this, setActive never runs,
        // the __client_uat cookie stays 0, and the redirect to /onboarding is
        // bounced back to /auth by the auth middleware.
        const w = typeof window !== "undefined" ? (window as any) : {};
        const sessionId =
          result?.createdSessionId ||
          w?.Clerk?.client?.lastActiveSessionId ||
          null;
        const isComplete = result?.status === "complete" || !!sessionId;

        if (isComplete) {
          if (sessionId) {
            try {
              await setActive({ session: sessionId });
            } catch {
              // setActive can throw if the session is already active -- safe to ignore.
            }
          }
          toast.success("Account created! Welcome to Zertech.");
          // Give the browser a beat to commit the session cookies written by
          // setActive before the hard navigation, otherwise the auth middleware
          // can see a stale __client_uat=0 and bounce back to /auth.
          await new Promise((r) => setTimeout(r, 120));
          go("/onboarding");
          return;
        }

        // status is "missing_requirements" -- e.g. email/phone verification needed.
        setError(
          "We started creating your account but extra verification is required. " +
            "Please check your email and complete the steps, then sign in."
        );
        return;
      } else {
        if (!signIn) {
          setError("Still loading -- please try again in a moment.");
          return;
        }

        const result: any = await signIn.create({
          identifier: email,
          password,
        });

        // Mirrors the signup logic: detect the session from the result OR the
        // live Clerk client, since the dev instance may report status !=
        // "complete" while a session is actually active.
        const w = typeof window !== "undefined" ? (window as any) : {};
        const sessionId =
          result?.createdSessionId ||
          w?.Clerk?.client?.lastActiveSessionId ||
          null;
        const isComplete = result?.status === "complete" || !!sessionId;

        if (isComplete) {
          if (sessionId) {
            try {
              await setActive({ session: sessionId });
            } catch {
              // setActive can throw if the session is already active -- safe to ignore.
            }
          }
          await new Promise((r) => setTimeout(r, 120));
          go("/dashboard");
          return;
        }

        // 2FA / additional verification required, OR identifier not found.
        // The Clerk SDK resolves (rather than rejecting) for some auth
        // failures, so surface a clear, accurate message.
        setError(
          "We couldn't sign you in. Check your email and password, then try again."
        );
        return;
      }
    } catch (err) {
      const msg = clerkMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      // Keep the guard up briefly so the post-submit redirect isn't
      // interrupted by the auto-redirect effect re-evaluating with a now-loaded user.
      setTimeout(() => {
        submittingRef.current = false;
      }, 4000);
    }
  };

  const google = async () => {
    if (!signIn || busy) return;
    setBusy(true);
    submittingRef.current = true;
    setError("");
    try {
      await (signIn as any).authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/auth/callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.long_message ||
        err?.errors?.[0]?.message ||
        "Google sign-in failed. Please try again.";
      setError(msg);
      setBusy(false);
      submittingRef.current = false;
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

            {error && (
              <div
                role="alert"
                className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Loading…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "No account?" : "Have an account?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
              }}
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
