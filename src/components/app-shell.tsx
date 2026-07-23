"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useClerk } from "@clerk/nextjs";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  CheckSquare,
  History,
  Settings,
  BarChart3,
  User,
  LogOut,
} from "lucide-react";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/approvals", label: "Drafts", icon: CheckSquare },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/history", label: "Activity", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const { signOut } = useClerk();
  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    router.replace("/auth");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col overflow-y-hidden border-r border-border bg-sidebar md:flex">
        <Link href="/dashboard" className="flex h-24 items-center gap-2 border-b border-border px-5">
          <img src="/logo.png" alt="Logo" className="h-24 w-auto" />
        </Link>
        <nav className="flex-1 space-y-0.5 px-2 py-4">
          {links.map((l) => {
            const active = pathname === l.to || pathname.startsWith(l.to + "/");
            return (
              <Link
                key={l.to}
                href={l.to}
                className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleSignOut}
          className="m-2 flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      {/* Mobile top nav */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-24 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="h-24 w-auto" />
        </Link>
        <button onClick={handleSignOut} className="text-sm text-muted-foreground">Sign out</button>
      </div>

      <main className="flex-1 overflow-y-auto pt-24 md:pt-0">
        <div className="md:hidden flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
          {links.map((l) => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.to}
                href={l.to}
                className={`shrink-0 rounded-sm px-3 py-1.5 text-xs ${
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-6 py-8 md:px-10">
      <div>
        <div className="mono-caps text-muted-foreground">{eyebrow}</div>
        <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="mono-caps text-muted-foreground">Nothing here yet</div>
      <div className="mt-3 font-mono text-xl font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
