import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  FolderOpen,
  Compass,
  GraduationCap,
  Users,
  MessageSquare,
  Trophy,
  Settings,
  LogOut,
  Search,
} from "lucide-react";
import { Logo } from "./logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnreadCounts } from "@/hooks/use-messages";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AvailabilitySelector, useUpdateAvailability } from "./availability-badge";
import type { AvailabilityStatus } from "@/lib/skill-match";

const rooms = [
  { to: "/dashboard", label: "Reception", sub: "Today's activity", icon: Home, live: true },
  { to: "/explore", label: "Projects", sub: "Creative studios", icon: FolderOpen, live: true },
  { to: "/community", label: "Community", sub: "Open space", icon: Users, live: true },
  { to: "/messages", label: "Messages", sub: "Meeting table", icon: MessageSquare, live: true },
  { to: "/profile", label: "Workshop", sub: "Your skills", icon: GraduationCap, live: true },
  { to: "/dashboard", label: "Sessions", sub: "Coming soon", icon: Trophy, live: false },
  { to: "/dashboard", label: "Library", sub: "Coming soon", icon: Compass, live: false },
] as const;

export function DashboardSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { data: unread } = useUnreadCounts();
  const { data: me } = useCurrentUser();
  const updateAvailability = useUpdateAvailability();

  const initial =
    me?.profile?.display_name?.charAt(0).toUpperCase() ??
    me?.profile?.handle?.charAt(0).toUpperCase() ??
    "T";

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border/60 bg-surface/40 bg-noise p-4">
      {/* Logo area */}
      <div className="px-2 py-2">
        <Logo />
      </div>

      {/* Quick search */}
      <button
        onClick={() => {
          const searchEl = document.querySelector<HTMLInputElement>('[aria-label="Global search"]');
          searchEl?.focus();
        }}
        className="mt-3 flex items-center gap-2.5 rounded-xl border border-border/40 bg-background/40 px-3 py-2 text-sm text-muted-foreground transition-all hover:border-border/60 hover:bg-surface/60 hover:text-foreground"
        aria-label="Quick search"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Search the workshop…</span>
        <kbd className="ml-auto rounded border border-border/60 bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          /
        </kbd>
      </button>

      {/* Room navigation */}
      <nav className="mt-5 flex flex-1 flex-col gap-0.5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
          Campus
        </p>
        {rooms.map((room, i) => {
          const Icon = room.icon;
          const isActive =
            room.to === "/dashboard"
              ? pathname === "/dashboard" && room.label === "Reception"
              : pathname.startsWith(room.to);

          if (!room.live) {
            return (
              <div
                key={room.label}
                title="Coming soon"
                className="flex cursor-not-allow items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground/30"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Icon className="h-4 w-4" />
                <div className="min-w-0 flex-1">
                  <span className="block text-sm">{room.label}</span>
                </div>
                <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">
                  Soon
                </span>
              </div>
            );
          }

          const badge =
            room.label === "Messages" && unread && unread.total > 0 ? unread.total : null;

          return (
            <Link
              key={room.label}
              to={room.to}
              onClick={onNavigate}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                isActive
                  ? "bg-surface-elevated text-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-green to-brand-purple" />
              )}
              <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-brand-green" : ""}`} />
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{room.label}</span>
              </div>
              {badge != null ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {badge}
                </span>
              ) : isActive ? (
                <span className="h-1.5 w-1.5 rounded-full bg-brand-green animate-gentle-pulse" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="mt-auto space-y-3 border-t border-border/60 pt-4">
        <AvailabilitySelector
          current={(me?.profile?.availability as AvailabilityStatus) ?? "available"}
          onSave={(s) => updateAvailability.mutate(s)}
        />

        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <Link
            to="/profile"
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-gradient-brand text-xs font-bold text-background transition-transform hover:scale-105"
            onClick={onNavigate}
          >
            {me?.avatarSigned ? (
              <img src={me.avatarSigned} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {me?.profile?.display_name || me?.profile?.handle || "Creator"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {me?.profile?.creator_title || "Workshop"}
            </p>
          </div>
          <Link
            to="/profile"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            aria-label="Settings"
            onClick={onNavigate}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Leave the workshop
        </button>
      </div>
    </aside>
  );
}
