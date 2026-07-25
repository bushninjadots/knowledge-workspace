import { CalendarDays, Clock, History, Bell, Calendar } from "lucide-react";
import type { SessionStatus } from "@/hooks/use-sessions";

const tabs = [
  { id: "upcoming", label: "Upcoming", icon: CalendarDays },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "history", label: "History", icon: History },
  { id: "requests", label: "Requests", icon: Bell },
  { id: "availability", label: "Availability", icon: Clock },
] as const;

export type SessionsTab = (typeof tabs)[number]["id"];

export const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  draft: { label: "Draft", color: "text-muted-foreground", bg: "bg-muted", icon: "📝" },
  scheduled: {
    label: "Scheduled",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
    icon: "📅",
  },
  invitation_sent: {
    label: "Invitation Sent",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950",
    icon: "📨",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950",
    icon: "✅",
  },
  in_progress: {
    label: "In Progress",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950",
    icon: "▶️",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950",
    icon: "🏁",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950",
    icon: "❌",
  },
};

export const TYPE_LABELS: Record<string, string> = {
  skill_exchange: "Skill Exchange",
  mentoring: "Mentoring",
  project_meeting: "Project Meeting",
  study_session: "Study Session",
  workshop: "Workshop",
  general: "General",
};

export function SessionsSidebar({
  activeTab,
  onTabChange,
  pendingCount,
}: {
  activeTab: SessionsTab;
  onTabChange: (tab: SessionsTab) => void;
  pendingCount: number;
}) {
  return (
    <nav className="flex flex-col gap-1">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
        Sessions
      </p>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
              isActive
                ? "bg-surface-elevated text-foreground shadow-soft"
                : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            }`}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-green to-brand-purple" />
            )}
            <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-brand-green" : ""}`} />
            <span className="min-w-0 flex-1 text-left text-sm font-medium">{tab.label}</span>
            {tab.id === "requests" && pendingCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {pendingCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
