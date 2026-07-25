import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnreadNotificationCount, useMarkAllAsRead } from "@/hooks/use-notifications";

export function NotificationHeader() {
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markAllAsRead = useMarkAllAsRead();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {unreadCount} unread
          </span>
        )}
      </div>
      {unreadCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => markAllAsRead.mutate()}
          disabled={markAllAsRead.isPending}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          Mark all as read
        </Button>
      )}
    </div>
  );
}
