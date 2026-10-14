import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/tethyr/page-header";
import { useUnreadNotificationCount, useMarkAllAsRead } from "@/hooks/use-notifications";

export function NotificationHeader() {
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markAllAsRead = useMarkAllAsRead();

  return (
    <PageHeader
      title="Notifications"
      meta={
        unreadCount > 0 && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {unreadCount} unread
          </span>
        )
      }
      description={
        <>
          Start with <span className="font-medium text-foreground">Needs action</span> when you want
          to focus on decisions and replies; everything else can wait.
        </>
      }
      actions={
        unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        )
      }
    />
  );
}
