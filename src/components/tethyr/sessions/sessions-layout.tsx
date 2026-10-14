import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { SessionsSidebar, type SessionsTab } from "./sessions-sidebar";
import { OverviewCards, NextSessionCountdown } from "./overview-cards";
import { TodaySchedule } from "./today-schedule";
import { UpcomingSessions } from "./upcoming-sessions";
import { SessionsCalendar } from "./sessions-calendar";
import { SessionRequests } from "./session-requests";
import { SessionHistory } from "./session-history";
import { AvailabilitySettings } from "./availability-settings";
import { ScheduleSessionWizard } from "./schedule-session-wizard";
import { SessionsBoard } from "./sessions-board";
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
import { PageHeader, pageContainerClass } from "@/components/tethyr/page-header";

export function SessionsLayout() {
  const navigate = useNavigate();
  // The active tab is URL-driven (?tab=requests) so the dashboard's "Review
  // requests" CTA and the pending-count badge can deep-link to the queue.
  const { tab, schedule } = useSearch({ from: "/_authenticated/sessions" });
  const activeTab: SessionsTab = tab ?? "board";
  const [wizardOpen, setWizardOpen] = useState(false);
  const [filters, setFilters] = useState<SessionFiltersState>({ search: "", type: "" });

  // The palette deep-links with ?schedule=1; open the wizard once and consume
  // the param so a later tab switch or repeat visit doesn't re-open it.
  useEffect(() => {
    if (schedule !== "1") return;
    setWizardOpen(true);
    navigate({ to: "/sessions", search: tab ? { tab } : {}, replace: true });
  }, [schedule, tab, navigate]);

  const setActiveTab = useCallback(
    (next: SessionsTab) => {
      navigate({
        to: "/sessions",
        search: next === "board" ? {} : { tab: next },
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
    <div className="flex h-[calc(100dvh-3rem)] animate-room-enter">
      {/* Left Sidebar */}
      <div className="hidden w-56 shrink-0 border-r border-border/60 bg-surface/30 bg-noise p-4 lg:block">
        <SessionsSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingCount={pendingCount}
        />
      </div>

      {/* Main Content */}
      {/* A plain scroller: Radix ScrollArea's table wrapper grows to the tab
          strip's full width and pushes the page off-screen on phones. */}
      <div className="min-w-0 flex-1 overflow-y-auto">
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
        <div className={pageContainerClass("default", "space-y-6")}>
          <PageHeader
            title="Sessions"
            description="Manage your collaborations, mentoring, and meetings."
            actions={
              <Button onClick={() => setWizardOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Schedule session
              </Button>
            }
          />

          {/* Tab content */}
          {activeTab === "board" && <SessionsBoard onSchedule={() => setWizardOpen(true)} />}

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
            <SessionsCalendar
              sessions={upcomingSessions}
              availability={availability}
              onSessionClick={goToSession}
            />
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
      </div>

      <ScheduleSessionWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
