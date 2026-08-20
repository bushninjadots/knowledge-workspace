import { useCallback, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SessionsSidebar, type SessionsTab } from "./sessions-sidebar";
import { OverviewCards, NextSessionCountdown } from "./overview-cards";
import { TodaySchedule } from "./today-schedule";
import { UpcomingSessions } from "./upcoming-sessions";
import { SessionsCalendar } from "./sessions-calendar";
import { SessionRequests } from "./session-requests";
import { SessionHistory } from "./session-history";
import { AvailabilitySettings } from "./availability-settings";
import { ScheduleSessionWizard } from "./schedule-session-wizard";
import { SessionFilters, type SessionFiltersState } from "./session-filters";
import {
  useSessionStats,
  useTodaySessions,
  useUpcomingSessions,
  useSessionRequests,
  useSessionHistory,
  useSessionAvailability,
  type SessionWithParticipants,
} from "@/hooks/use-sessions";

export function SessionsLayout() {
  const navigate = useNavigate();
  // The active tab is URL-driven (?tab=requests) so the dashboard's "Review
  // requests" CTA and the pending-count badge can deep-link to the queue.
  const { tab } = useSearch({ from: "/_authenticated/sessions" });
  const activeTab: SessionsTab = tab ?? "upcoming";
  const [wizardOpen, setWizardOpen] = useState(false);
  const [filters, setFilters] = useState<SessionFiltersState>({ search: "", type: "" });

  const setActiveTab = useCallback(
    (next: SessionsTab) => {
      navigate({
        to: "/sessions",
        search: next === "upcoming" ? {} : { tab: next },
        replace: true,
      });
    },
    [navigate],
  );

  const filterSessions = useCallback(
    (sessions: SessionWithParticipants[] | undefined) => {
      if (!sessions) return sessions;
      return sessions.filter((s) => {
        if (filters.search && !s.title.toLowerCase().includes(filters.search.toLowerCase()))
          return false;
        if (filters.type && filters.type !== "all" && s.session_type !== filters.type) return false;
        return true;
      });
    },
    [filters],
  );

  const { data: stats } = useSessionStats();
  const { data: todaySessions = [] } = useTodaySessions();
  const { data: upcomingSessions = [] } = useUpcomingSessions();
  const { data: requests = [] } = useSessionRequests();
  const { data: historySessions = [], isLoading: historyLoading } = useSessionHistory();
  const { data: availability = [], refetch: refetchAvailability } = useSessionAvailability();

  const pendingCount = requests.filter((r) => r.status === "pending" && r.to_user_id).length;

  const nextSession = upcomingSessions[0] ?? null;

  function goToSession(session: SessionWithParticipants) {
    navigate({ to: "/sessions/$id", params: { id: session.id } });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-room-enter">
      {/* Left Sidebar */}
      <div className="hidden w-56 shrink-0 border-r border-border/60 bg-surface/30 bg-noise p-4 lg:block">
        <SessionsSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingCount={pendingCount}
        />
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="border-b border-border/60 bg-surface/30 px-2 py-2 lg:hidden">
          <div className="overflow-x-auto">
            <SessionsSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              pendingCount={pendingCount}
              orientation="horizontal"
            />
          </div>
        </div>
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Sessions</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your collaborations, mentoring, and meetings.
              </p>
            </div>
            <button
              onClick={() => setWizardOpen(true)}
              className="rounded-xl bg-[var(--user-accent,var(--trust))] px-4 py-2.5 text-sm font-semibold text-[var(--user-accent-foreground,var(--background))] transition-all hover:opacity-90 hover:shadow-soft active:scale-[0.98]"
            >
              + Schedule Session
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "upcoming" && (
            <div className="space-y-6">
              <SessionFilters filters={filters} onChange={setFilters} />

              {/* Stats */}
              <OverviewCards stats={stats} />

              {/* Next session countdown */}
              {nextSession && <NextSessionCountdown nextSession={nextSession} />}

              {/* Today */}
              <TodaySchedule sessions={todaySessions} onSessionClick={goToSession} />

              {/* Upcoming */}
              <UpcomingSessions
                sessions={filterSessions(upcomingSessions) ?? []}
                onSessionClick={goToSession}
              />
            </div>
          )}

          {activeTab === "calendar" && (
            <SessionsCalendar sessions={upcomingSessions} availability={availability} onSessionClick={goToSession} />
          )}

          {activeTab === "history" && (
            <>
              <SessionFilters filters={filters} onChange={setFilters} />
              <SessionHistory
                sessions={filterSessions(historySessions) ?? []}
                loading={historyLoading}
              />
            </>
          )}

          {activeTab === "requests" && <SessionRequests requests={requests} />}

          {activeTab === "availability" && (
            <AvailabilitySettings availability={availability} onSaved={refetchAvailability} />
          )}
        </div>
      </ScrollArea>

      <ScheduleSessionWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
