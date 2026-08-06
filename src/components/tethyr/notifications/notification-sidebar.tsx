import { Inbox, MessageCircle, Calendar, Users, FolderOpen, Star, Trophy } from "lucide-react";
import { useNotificationsByCategory } from "@/hooks/use-notifications";

const NOTIFICATION_CATEGORIES = [
  { id: "all", label: "All", icon: Inbox },
  { id: "message", label: "Messages", icon: MessageCircle },
  {
    id: "session",
    label: "Sessions",
    icon: Calendar,
    matchTypes: ["session_invite", "session_update"],
  },
  {
    id: "community",
    label: "Community",
    icon: Users,
    matchTypes: ["comment", "mention", "follow"],
  },
  {
    id: "project",
    label: "Projects",
    icon: FolderOpen,
    matchTypes: ["project_invite", "project_join", "project_post"],
  },
  {
    id: "reputation",
    label: "Reputation",
    icon: Star,
    matchTypes: ["endorsement", "connection_request", "connection_accepted"],
  },
  { id: "achievement", label: "Achievements", icon: Trophy },
] as const;

interface NotificationSidebarProps {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
}

export function NotificationSidebar({
  activeCategory,
  onCategoryChange,
}: NotificationSidebarProps) {
  const { data: categoryCounts = {} } = useNotificationsByCategory();

  function getCount(cat: (typeof NOTIFICATION_CATEGORIES)[number]): number {
    if (cat.id === "all") {
      return Object.values(categoryCounts).reduce((a: number, b: number) => a + b, 0);
    }
    const types = (cat as { matchTypes?: readonly string[] }).matchTypes ?? [cat.id];
    return types.reduce((sum: number, t: string) => sum + (categoryCounts[t] ?? 0), 0);
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {NOTIFICATION_CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const count = getCount(cat);
        const isActive = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
              isActive
                ? "bg-surface-elevated text-foreground shadow-soft"
                : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            }`}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-[var(--user-accent,var(--trust))] to-[var(--ai)]" />
            )}
            <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-[var(--user-accent,var(--trust))]" : ""}`} />
            <span className="min-w-0 flex-1 text-left text-sm font-medium">{cat.label}</span>
            {count > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
