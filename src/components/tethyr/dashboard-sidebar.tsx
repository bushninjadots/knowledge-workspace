import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Compass,
  MessagesSquare,
  BookOpen,
  Users,
  Settings,
  UserCircle,
  LogOut,
} from "lucide-react";
import { Logo } from "./logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/profile", label: "Profile", icon: UserCircle },
  { to: "/dashboard", label: "Explore", icon: Compass },
  { to: "/dashboard", label: "Sessions", icon: MessagesSquare },
  { to: "/dashboard", label: "Library", icon: BookOpen },
  { to: "/dashboard", label: "Community", icon: Users },
  { to: "/dashboard", label: "Settings", icon: Settings },
] as const;

export function DashboardSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border/60 bg-surface/40 p-4">
      <div className="px-2 py-2">
        <Logo />
      </div>
      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {nav.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={handleSignOut}
        className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </aside>
  );
}
