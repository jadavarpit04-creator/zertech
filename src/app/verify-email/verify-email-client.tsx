"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, CheckCircle } from "lucide-react";

interface VerifyEmailClientProps {
  email: string;
}

export default function VerifyEmailClient({ email }: VerifyEmailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "verified" | "error">("checking");
  const [emailState, setEmailState] = useState(email);

  useEffect(() => {
    // Check if there's a session (user just confirmed email and was redirected back)
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setStatus("verified");
        // Redirect based on whether they're a new user
        setTimeout(() => {
          router.push("/onboarding");
        }, 1000);
      } else {
        setStatus("checking"); // Will show "check your email" UI
      }
    };
    checkSession();
  }, [router]);

  const resendEmail = async () => {
    if (!emailState) return;
    try {
      await supabase.auth.resend({ type: "signup", email: emailState });
      toast.success("Verification email resent!");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to resend email");
    }
  };

  if (status === "verified") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="font-mono text-2xl font-bold">Email verified!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Redirecting to onboarding&hellip;
          </p>
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </motion.div>
      </div>
    );
  }

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
        <div className="rounded-sm border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="font-mono text-2xl font-bold">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;ve sent a verification link to
            <span className="font-medium ml-1">{emailState || "your email"}</span>
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Click the link in the email to verify your account, then come back
            here.
          </p>

          <div className="mt-6 space-y-3">
            <button
              onClick={resendEmail}
              disabled={!emailState}
              className="w-full rounded-sm border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Resend verification email
            </button>
            <button
              onClick={() => router.push("/auth?mode=signin")}
              className="w-full rounded-sm border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Already verified? Sign in
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Didn&apos;t receive it?{" "}
            <span className="text-foreground underline underline-offset-4 cursor-pointer" onClick={resendEmail}>
              Resend
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}