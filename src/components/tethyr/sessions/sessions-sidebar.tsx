import { CalendarDays, Clock, History, Bell, Calendar } from "lucide-react";
import type { SessionStatus } from "@/hooks/use-sessions";

const tabs = [
  { id: "upcoming", label: "Upcoming", icon: CalendarDays },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "history", label: "History", icon: History },
  { id: "requests", label: "Requests", icon: Bell },
  { id: "availability", label: "Weekly schedule", icon: Clock },
] as const;

export type SessionsTab = (typeof tabs)[number]["id"];

export const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  draft: { label: "Draft", color: "text-muted-foreground", bg: "bg-muted", icon: "📝" },
  scheduled: {
    label: "Scheduled",
    color: "text-learning",
    bg: "bg-learning-subtle",
    icon: "📅",
  },
  invitation_sent: {
    label: "Invitation Sent",
    color: "text-teaching",
    bg: "bg-teaching-subtle",
    icon: "📨",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-trust",
    bg: "bg-trust-subtle",
    icon: "✅",
  },
  in_progress: {
    label: "In Progress",
    color: "text-ai",
    bg: "bg-ai-subtle",
    icon: "▶️",
  },
  completed: {
    label: "Completed",
    color: "text-trust",
    bg: "bg-trust-subtle",
    icon: "🏁",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-warning",
    bg: "bg-warning-subtle",
    icon: "❌",
  },
};

export const TYPE_LABELS: Record<string, string> = {
  skill_exchange: "Collaboration",
  mentoring: "Mentoring",
  project_meeting: "Project Meeting",
  study_session: "Study Session",
  workshop: "Collaboration",
  general: "General",
};

export function SessionsSidebar({
  activeTab,
  onTabChange,
  pendingCount,
  orientation = "vertical",
}: {
  activeTab: SessionsTab;
  onTabChange: (tab: SessionsTab) => void;
  pendingCount: number;
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <nav
      aria-label="Sessions navigation"
      className={
        orientation === "horizontal" ? "flex min-w-max items-center gap-1" : "flex flex-col gap-1"
      }
    >
      <p
        className={`${
          orientation === "horizontal" ? "sr-only" : "mb-2 px-3"
        } text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground`}
      >
        Sessions
      </p>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
              isActive
                ? "bg-surface-elevated text-foreground shadow-soft"
                : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            }`}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-[var(--user-accent,var(--trust))] to-[var(--ai)]" />
            )}
            <Icon
              className={`h-4 w-4 transition-colors ${isActive ? "text-[var(--user-accent,var(--trust))]" : ""}`}
            />
            <span className="min-w-0 flex-1 text-left text-sm font-medium">{tab.label}</span>
            {tab.id === "requests" && pendingCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                {pendingCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
