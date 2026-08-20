import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useNotifications, useNotificationRealtime } from "@/hooks/use-notifications";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { NotificationHeader } from "@/components/tethyr/notifications/notification-header";
import { NotificationFeed } from "@/components/tethyr/notifications/notification-feed";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NotificationType, Notification } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { getNotificationDestination } from "@/lib/notification-destinations";
import {
  TYPE_CATEGORY,
  CATEGORY_LABELS,
  type NotificationCategory,
} from "@/lib/notification-categories";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — Tethyr" }],
  }),
  component: NotificationsPage,
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Notifications unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unable to load notifications. Please try again.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <Link to="/dashboard">
            <Button variant="outline">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  ),
});

// Every notification type has exactly one canonical home (see
// `lib/notification-categories.ts`), so tabs never show the same item twice
// and muting a category maps 1:1 to the tab that would show it.
const CATEGORY_TYPE_MAP: Record<string, NotificationType[] | null> = {
  all: null,
  // Cross-cutting “decisions and replies” queue — intentionally overlaps the
  // category tabs below.
  action: [
    "connection_request",
    "session_invite",
    "project_invite",
    "team_invite",
    "role_application_accepted",
    "role_application_declined",
    "challenge_submitted",
    "challenge_resubmitted",
  ],
  // The remaining tabs are derived from the shared type→category map so the
  // page can never drift from the preferences in /settings.
  ...Object.fromEntries(
    (Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((category) => [
      category,
      (Object.entries(TYPE_CATEGORY) as [NotificationType, NotificationCategory][])
        .filter(([, c]) => c === category)
        .map(([type]) => type),
    ]),
  ),
};

const TABS = [
  { key: "all", label: "All" },
  { key: "action", label: "Needs action" },
  { key: "message", label: "Messages" },
  { key: "session", label: "Sessions" },
  { key: "community", label: "Community" },
  { key: "project", label: "Projects" },
  { key: "reputation", label: "Reputation" },
  { key: "achievement", label: "Achievements" },
  { key: "moderation", label: "Moderation" },
] as const;

function useNotificationNavigator() {
  const navigate = useNavigate();

  return function navigateToNotification(n: Notification) {
    navigate(getNotificationDestination(n));
  };
}

function NotificationsPage() {
  useNotificationRealtime();
  const [activeCategory, setActiveCategory] = useState("all");
  const navigateToNotification = useNotificationNavigator();
  const { mutedCategories } = useNotificationPreferences();
  const muted = new Set(mutedCategories);

  const types = CATEGORY_TYPE_MAP[activeCategory];
  const filterType = types && types.length === 1 ? types[0] : undefined;

  const { data: allNotifications = [], isLoading } = useNotifications(
    filterType ? { type: filterType } : undefined,
  );

  const notifications = (
    types && types.length > 1
      ? allNotifications.filter((n) => types.includes(n.type))
      : allNotifications
  ).filter((n) => !muted.has(TYPE_CATEGORY[n.type]));

  return (
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <NotificationHeader />
        <main className="mt-6 min-w-0">
          <p className="mb-3 text-sm text-muted-foreground">
            Start with <span className="font-medium text-foreground">Needs action</span> when you
            want to focus on decisions and replies; everything else can wait.
          </p>
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-6">
            <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="whitespace-nowrap text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <NotificationFeed
            notifications={notifications}
            isLoading={isLoading}
            onNavigate={navigateToNotification}
          />
        </main>
      </div>
    </div>
  );
}
