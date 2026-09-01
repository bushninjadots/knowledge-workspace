import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import {
  Home,
  FolderOpen,
  Compass,
  User,
  Users,
  MessageSquare,
  Trophy,
  LogOut,
  Bell,
  Swords,
  Link2,
  Settings,
  Palette,
} from "lucide-react";
import { Logo } from "./logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnreadCounts } from "@/hooks/use-messages";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AvailabilitySelector, useUpdateAvailability } from "./availability-badge";

// GlobalSearch pulls in six data-source queries and the search UI — keep it
// off the sidebar's initial render so authed pages hydrate faster.
const GlobalSearch = lazy(() =>
  import("./global-search").then((m) => ({ default: m.GlobalSearch })),
);
import type { AvailabilityStatus } from "@/lib/skill-match";
import { CreateProjectButton } from "./create-project-button";

const groups = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: Home },
      { to: "/library", label: "Library", icon: FolderOpen },
    ],
  },
  {
    label: "Discover",
    items: [
      { to: "/explore", label: "Explore", icon: Compass },
      { to: "/challenges", label: "Challenges", icon: Swords },
      { to: "/sessions", label: "Sessions", icon: Trophy },
    ],
  },
  {
    label: "Network",
    items: [
      { to: "/community", label: "Community", icon: Users },
      { to: "/connections", label: "Connections", icon: Link2 },
      { to: "/messages", label: "Messages", icon: MessageSquare },
      { to: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/profile", label: "Your Studio", icon: User },
      { to: "/studio", label: "Creation Studio", icon: Palette },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

export function DashboardSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { data: unread } = useUnreadCounts();
  const { data: notifUnread = 0 } = useUnreadNotificationCount();
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
    <aside className="flex h-full w-60 flex-col border-r border-border bg-surface relative">
      {/* Animated accent bar on right edge */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-px opacity-0 transition-opacity duration-700 hover:opacity-100"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--user-accent, var(--trust)) 30%, var(--ai) 70%, transparent)",
        }}
      />
      <div className="flex h-12 items-center border-b border-border px-3">
        <Logo />
      </div>

      <div className="px-3 py-3">
        <Suspense
          fallback={
            <div
              aria-hidden="true"
              className="h-9 animate-pulse rounded-xl border border-border/40 bg-surface-elevated/50"
            />
          }
        >
          <GlobalSearch variant="inline" />
        </Suspense>
      </div>

      <div className="px-2 pb-2">
        <CreateProjectButton
          label="New project"
          className="h-auto w-full justify-start rounded-sm px-2 py-1.5 text-[13px]"
        />
      </div>

      <div className="mx-2 mb-2 h-px bg-border" />

      <nav
        aria-label="Dashboard navigation"
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 pb-4"
      >
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-col">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.to === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.to);

                const badge =
                  item.label === "Messages" && unread && unread.total > 0
                    ? unread.total
                    : item.label === "Notifications" && notifUnread > 0
                      ? notifUnread
                      : null;

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex h-7 items-center gap-2 rounded-sm px-2 text-[13px] transition-colors ${
                      isActive
                        ? "bg-[var(--user-accent-subtle,var(--learning-subtle))] font-medium text-[var(--user-accent,var(--foreground))]"
                        : "text-muted-foreground hover:bg-surface-sunken hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {badge != null && (
                      <span className="rounded-sm bg-border-strong/40 px-1.5 text-[11px] font-medium tabular-nums text-foreground">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-border px-2 py-2">
        <div className="px-2 pb-2">
          <AvailabilitySelector
            current={(me?.profile?.availability as AvailabilityStatus) ?? "available"}
            onSave={(s) => updateAvailability.mutate(s)}
            openUp
          />
        </div>

        <div className="flex items-center gap-2 rounded-sm px-2 py-1.5">
          <Link
            to="/profile"
            className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-sunken text-[11px] font-semibold text-foreground"
            onClick={onNavigate}
          >
            {me?.avatarSigned ? (
              <img
                src={me.avatarSigned}
                alt=""
                width="24"
                height="24"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight">
              {me?.profile?.display_name || me?.profile?.handle || "Member"}
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {me?.profile?.creator_title || "Member"}
            </p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex h-7 w-full items-center gap-2 rounded-sm px-2 text-[13px] text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
