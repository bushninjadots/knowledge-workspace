import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  const [activeTab, setActiveTab] = useState<SessionsTab>("upcoming");
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: stats } = useSessionStats();
  const { data: todaySessions = [] } = useTodaySessions();
  const { data: upcomingSessions = [] } = useUpcomingSessions();
  const { data: requests = [] } = useSessionRequests();
  const { data: historySessions = [], isLoading: historyLoading } = useSessionHistory();
  const { data: availability = [] } = useSessionAvailability();

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
        <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your collaborations, mentoring, and meetings.
              </p>
            </div>
            <button
              onClick={() => setWizardOpen(true)}
              className="rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-brand-green/90 hover:shadow-soft active:scale-[0.98]"
            >
              + Schedule Session
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "upcoming" && (
            <div className="space-y-6">
              {/* Stats */}
              <OverviewCards stats={stats} />

              {/* Next session countdown */}
              {nextSession && <NextSessionCountdown nextSession={nextSession} />}

              {/* Today */}
              <TodaySchedule sessions={todaySessions} onSessionClick={goToSession} />

              {/* Upcoming */}
              <UpcomingSessions sessions={upcomingSessions} onSessionClick={goToSession} />
            </div>
          )}

          {activeTab === "calendar" && (
            <SessionsCalendar sessions={upcomingSessions} onSessionClick={goToSession} />
          )}

          {activeTab === "history" && (
            <SessionHistory sessions={historySessions} loading={historyLoading} />
          )}

          {activeTab === "requests" && <SessionRequests requests={requests} />}

          {activeTab === "availability" && <AvailabilitySettings availability={availability} />}
        </div>
      </ScrollArea>

      <ScheduleSessionWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
