import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useNotifications,
  useNotificationRealtime,
  useNotificationsByCategory,
} from "@/hooks/use-notifications";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { NotificationHeader } from "@/components/tethyr/notifications/notification-header";
import { NotificationFeed } from "@/components/tethyr/notifications/notification-feed";
import { SegmentedControl } from "@/components/tethyr/segmented-control";
import type { Notification } from "@/hooks/use-notifications";
import { getNotificationDestination } from "@/lib/notification-destinations";
import {
  NOTIFICATION_CATEGORY_VIEWS,
  typesForNotificationView,
  isNotificationMuted,
  isNotificationCategoryViewKey,
  notificationViewUnreadCounts,
  type NotificationCategoryViewKey,
} from "@/lib/notification-categories";

// Code-split module: the interactive page for its route. See the route
// file for the eager surface (loader/head) and the lazyRouteComponent wire-up.
function useNotificationNavigator() {
  const navigate = useNavigate();

  return function navigateToNotification(n: Notification) {
    navigate(getNotificationDestination(n));
  };
}

function NotificationTabLabel({ name, count }: { name: string; count: number }) {
  return (
    <span className="flex items-center gap-1.5">
      {name}
      {count > 0 && (
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </span>
  );
}

export function NotificationsPage() {
  useNotificationRealtime();
  const [activeCategory, setActiveCategory] = useState<NotificationCategoryViewKey>("all");
  const navigateToNotification = useNotificationNavigator();
  const { mutedCategories } = useNotificationPreferences();
  const { data: unreadByType = {} } = useNotificationsByCategory();
  const muted = new Set(mutedCategories);

  const viewCounts = notificationViewUnreadCounts(unreadByType, mutedCategories);

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
          <SegmentedControl
            value={activeCategory}
            onChange={(value) => {
              if (isNotificationCategoryViewKey(value)) setActiveCategory(value);
            }}
            ariaLabel="Notification views"
            className="mb-6"
            options={NOTIFICATION_CATEGORY_VIEWS.map((tab) => ({
              value: tab.key,
              label: <NotificationTabLabel name={tab.label} count={viewCounts[tab.key]} />,
            }))}
          />
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
