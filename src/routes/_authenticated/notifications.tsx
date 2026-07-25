import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useNotifications, useNotificationRealtime } from "@/hooks/use-notifications";
import { NotificationHeader } from "@/components/tethyr/notifications/notification-header";
import { NotificationSidebar } from "@/components/tethyr/notifications/notification-sidebar";
import { NotificationFeed } from "@/components/tethyr/notifications/notification-feed";
import type { NotificationType } from "@/hooks/use-notifications";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

const CATEGORY_TYPE_MAP: Record<string, NotificationType[] | null> = {
  all: null,
  message: ["message"],
  session: ["session_invite", "session_update"],
  community: ["comment", "mention", "follow"],
  project: ["project_invite", "project_join"],
  reputation: ["endorsement", "connection_request", "connection_accepted"],
  achievement: ["achievement"],
};

function NotificationsPage() {
  useNotificationRealtime();
  const [activeCategory, setActiveCategory] = useState("all");

  const types = CATEGORY_TYPE_MAP[activeCategory];
  const filterType = types && types.length === 1 ? types[0] : undefined;

  const { data: allNotifications = [], isLoading } = useNotifications(
    filterType ? { type: filterType } : undefined,
  );

  // For multi-type categories, filter client-side
  const notifications =
    types && types.length > 1
      ? allNotifications.filter((n) => types.includes(n.type))
      : allNotifications;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <NotificationHeader />
      <div className="mt-6 flex gap-8">
        {/* Sidebar */}
        <aside className="hidden w-48 shrink-0 md:block">
          <NotificationSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </aside>

        {/* Feed */}
        <main className="min-w-0 flex-1">
          <NotificationFeed notifications={notifications} isLoading={isLoading} />
        </main>
      </div>
    </div>
  );
}
