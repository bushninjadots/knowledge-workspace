import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useNotifications, useNotificationRealtime } from "@/hooks/use-notifications";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { NotificationHeader } from "@/components/tethyr/notifications/notification-header";
import { NotificationFeed } from "@/components/tethyr/notifications/notification-feed";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Notification } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { getNotificationDestination } from "@/lib/notification-destinations";
import {
  TYPE_CATEGORY,
  NOTIFICATION_CATEGORY_VIEWS,
  typesForNotificationView,
  isNotificationMuted,
  isNotificationCategoryViewKey,
  type NotificationCategoryViewKey,
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

// Category browsing is exclusive; Needs action is the only intentional
// cross-cutting view. Both definitions live in the shared category module so
// the route and Settings cannot drift apart.
function useNotificationNavigator() {
  const navigate = useNavigate();

  return function navigateToNotification(n: Notification) {
    navigate(getNotificationDestination(n));
  };
}

function NotificationsPage() {
  useNotificationRealtime();
  const [activeCategory, setActiveCategory] = useState<NotificationCategoryViewKey>("all");
  const navigateToNotification = useNotificationNavigator();
  const { mutedCategories } = useNotificationPreferences();
  const muted = new Set(mutedCategories);

  const types = typesForNotificationView(activeCategory);
  const filterType = types && types.length === 1 ? types[0] : undefined;

  const { data: allNotifications = [], isLoading } = useNotifications(
    filterType ? { type: filterType } : undefined,
  );

  const notifications = (
    types && types.length > 1
      ? allNotifications.filter((n) => types.includes(n.type))
      : allNotifications
  ).filter((n) => !isNotificationMuted(n.type, [...muted]));

  return (
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <NotificationHeader />
        <section className="mt-6 min-w-0" aria-label="Notifications content">
          <p className="mb-3 text-sm text-muted-foreground">
            Start with <span className="font-medium text-foreground">Needs action</span> when you
            want to focus on decisions and replies; everything else can wait.
          </p>
          <Tabs
            value={activeCategory}
            onValueChange={(value) => {
              if (isNotificationCategoryViewKey(value)) setActiveCategory(value);
            }}
            className="mb-6"
          >
            <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
              {NOTIFICATION_CATEGORY_VIEWS.map((tab) => (
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
        </section>
      </div>
    </div>
  );
}
