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
import { useUnreadCounts } from "@/hooks/use-messages";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AvailabilitySelector, useUpdateAvailability } from "./availability-badge";
import type { AvailabilityStatus } from "@/lib/skill-match";

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, live: true },
  { to: "/profile", label: "Profile", icon: UserCircle, live: true },
  { to: "/explore", label: "Explore", icon: Compass, live: true },
  { to: "/messages", label: "Messages", icon: MessagesSquare, live: true },
  { to: "/community", label: "Community", icon: Users, live: true },
  { to: "/dashboard", label: "Sessions", icon: BookOpen, live: false },
  { to: "/dashboard", label: "Library", icon: BookOpen, live: false },
  { to: "/dashboard", label: "Settings", icon: Settings, live: false },
] as const;

export function DashboardSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { data: unread } = useUnreadCounts();
  const { data: me } = useCurrentUser();
  const updateAvailability = useUpdateAvailability();

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
      <div className="mt-3 px-1">
        <AvailabilitySelector
          current={(me?.profile?.availability as AvailabilityStatus) ?? "available"}
          onSave={(s) => updateAvailability.mutate(s)}
        />
      </div>
      <nav className="mt-4 flex flex-1 flex-col gap-1">
        {nav.map((item) => {
          const Icon = item.icon;

          if (!item.live) {
            return (
              <div
                key={item.label}
                title="Coming soon"
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground/40"
              >
                <Icon className="h-4 w-4" />
                {item.label}
                <span className="ml-auto rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] uppercase tracking-wider">
                  Soon
                </span>
              </div>
            );
          }

          const active = pathname === item.to;
          const badge =
            item.label === "Messages" && unread && unread.total > 0 ? unread.total : null;
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
              {badge != null ? (
                <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {badge}
                </span>
              ) : active ? (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              ) : null}
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
