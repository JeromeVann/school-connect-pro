import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Home,
  LogOut,
  Megaphone,
  Receipt,
  Users,
  Wallet,
  GraduationCap,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const adminNav = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/students", label: "Students", icon: Users },
  { to: "/invoices", label: "Invoices", icon: Receipt },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/announcements", label: "Notices", icon: Megaphone },
] as const;

const parentNav = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/children", label: "Children", icon: GraduationCap },
  { to: "/announcements", label: "Notices", icon: Megaphone },
  { to: "/notifications", label: "Alerts", icon: Bell },
] as const;

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const nav = isAdmin ? adminNav : parentNav;

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-4" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {isAdmin ? "Administrator" : "Parent"}
              </p>
              <h1 className="text-base font-semibold leading-tight text-foreground">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/notifications" aria-label="Notifications">
              <Button variant="ghost" size="icon">
                <Bell className="size-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card">
        <div className="mx-auto flex max-w-5xl">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary font-semibold" }}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
