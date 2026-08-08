import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useNotifications, useNotificationRealtime } from "@/hooks/use-notifications";
import { NotificationHeader } from "@/components/tethyr/notifications/notification-header";
import { NotificationFeed } from "@/components/tethyr/notifications/notification-feed";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NotificationType, Notification } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — Tethyr" }],
  }),
  component: NotificationsPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Notifications unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message ||
            "Unable to load notifications. The notifications service may be temporarily unavailable."}
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

const CATEGORY_TYPE_MAP: Record<string, NotificationType[] | null> = {
  all: null,
  message: ["message"],
  session: ["session_invite", "session_update"],
  community: [
    "comment",
    "mention",
    "follow",
    "challenge_join",
    "challenge_complete",
    "challenge_submitted",
    "challenge_resubmitted",
    "join_approved",
    "join_rejected",
  ],
  project: ["project_invite", "project_join", "project_post"],
  reputation: ["endorsement", "connection_request", "connection_accepted"],
  achievement: ["achievement"],
  moderation: ["post_report", "report_resolved"],
};

const TABS = [
  { key: "all", label: "All" },
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
    switch (n.type) {
      case "message":
        navigate({ to: "/messages" });
        break;
      case "comment":
      case "mention":
        navigate({ to: "/community" });
        break;
      case "session_invite":
      case "session_update":
        if (n.entity_id) {
          navigate({ to: "/sessions/$id", params: { id: n.entity_id } });
        } else {
          navigate({ to: "/sessions" });
        }
        break;
      case "achievement":
        navigate({ to: "/profile" });
        break;
      case "endorsement":
        navigate({ to: "/profile" });
        break;
      case "project_join":
      case "project_post":
        navigate({ to: "/explore" });
        break;
      case "connection_request":
      case "connection_accepted":
      case "follow":
        navigate({ to: "/profile" });
        break;
      case "challenge_join":
      case "challenge_complete":
      case "challenge_submitted":
      case "challenge_resubmitted":
        if (n.entity_id) {
          navigate({ to: "/challenges/$id", params: { id: n.entity_id } });
        } else {
          navigate({ to: "/community" });
        }
        break;
      case "join_approved":
      case "join_rejected":
      case "post_report":
      case "report_resolved":
        navigate({ to: "/community" });
        break;
      default:
        toast.info("This notification doesn't have a linked page yet.");
    }
  };
}

function NotificationsPage() {
  useNotificationRealtime();
  const [activeCategory, setActiveCategory] = useState("all");
  const navigateToNotification = useNotificationNavigator();

  const types = CATEGORY_TYPE_MAP[activeCategory];
  const filterType = types && types.length === 1 ? types[0] : undefined;

  const { data: allNotifications = [], isLoading } = useNotifications(
    filterType ? { type: filterType } : undefined,
  );

  const notifications =
    types && types.length > 1
      ? allNotifications.filter((n) => types.includes(n.type))
      : allNotifications;

  return (
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <NotificationHeader />
        <main className="mt-6 min-w-0">
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
