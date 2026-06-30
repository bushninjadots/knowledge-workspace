import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Compass,
  MessagesSquare,
  BookOpen,
  Users,
  Settings,
} from "lucide-react";
import { Logo } from "./logo";

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard", label: "Explore", icon: Compass },
  { to: "/dashboard", label: "Sessions", icon: MessagesSquare },
  { to: "/dashboard", label: "Library", icon: BookOpen },
  { to: "/dashboard", label: "Community", icon: Users },
  { to: "/dashboard", label: "Settings", icon: Settings },
];

export function DashboardSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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
              key={item.to}
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
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-border/60 bg-surface/60 p-4">
        <p className="text-xs font-medium text-foreground">Your reputation</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Teach a session to start earning trust points.
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background">
          <div className="h-full w-[15%] rounded-full bg-gradient-brand" />
        </div>
      </div>
    </aside>
  );
}
