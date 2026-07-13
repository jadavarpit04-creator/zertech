import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  FileText,
  Users,
  CheckSquare,
  History,
  Settings,
  LogOut,
} from "lucide-react";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/approvals", label: "Approvals", icon: CheckSquare },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <Link to="/dashboard" className="flex h-14 items-center gap-2 border-b border-border px-5">
          <div className="h-4 w-4 bg-foreground" />
          <span className="font-mono text-sm font-semibold tracking-tight">FOLLOWUP</span>
        </Link>
        <nav className="flex-1 space-y-0.5 px-2 py-4">
          {links.map((l) => {
            const active = pathname === l.to || pathname.startsWith(l.to + "/");
            return (
              <Link
                key={l.to}
                to={l.to}
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
          onClick={signOut}
          className="m-2 flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      {/* Mobile top nav */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="h-4 w-4 bg-foreground" />
          <span className="font-mono text-sm font-semibold">FOLLOWUP</span>
        </Link>
        <button onClick={signOut} className="text-sm text-muted-foreground">Sign out</button>
      </div>

      <main className="flex-1 pt-14 md:pt-0">
        <div className="md:hidden flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
          {links.map((l) => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
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
