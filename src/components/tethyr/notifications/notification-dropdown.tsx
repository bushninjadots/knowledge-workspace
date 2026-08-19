import { Bell, CheckCheck } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useUnreadNotificationCount,
  useNotificationRealtime,
} from "@/hooks/use-notifications";
import { toast } from "sonner";
import type { Notification } from "@/hooks/use-notifications";
import { getNotificationDestination } from "@/lib/notification-destinations";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function NotificationDropdown() {
  useNotificationRealtime();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data: notifications = [], isLoading } = useNotifications({ unreadOnly: true }, 10);
  const markAllAsRead = useMarkAllAsRead();
  const markAsRead = useMarkAsRead();
  const navigate = useNavigate();

  function handleNotificationClick(n: Notification) {
    // Mark as read
    markAsRead.mutate([n.id], {
      onError: () => toast.error("Failed to mark as read"),
    });

    navigate(getNotificationDestination(n));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative rounded-full p-2 hover:bg-surface transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground animate-gentle-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <span className="text-sm font-medium">Notifications</span>
          <Link to="/notifications" className="text-xs text-primary hover:underline">
            View All
          </Link>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</div>
          )}
          {!isLoading && notifications.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              All caught up!
            </div>
          )}
          {notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex items-start gap-3 px-4 py-3 cursor-pointer"
              onClick={() => handleNotificationClick(n)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{n.title}</p>
                {n.body && (
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{n.body}</p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
        {unreadCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-xs"
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
              >
                <CheckCheck className="mr-2 h-3.5 w-3.5" />
                Mark all as read
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
