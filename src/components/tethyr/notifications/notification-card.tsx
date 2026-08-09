import { toast } from "sonner";
import {
  MessageCircle,
  UserPlus,
  CheckCircle,
  CalendarPlus,
  CalendarClock,
  MessageSquare,
  AtSign,
  Star,
  Trophy,
  FolderPlus,
  Users,
  BriefcaseBusiness,
  Heart,
  MoreHorizontal,
  Check,
  Archive,
  Trash2,
  UserCheck,
  UserX,
  Swords,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useMarkAsRead,
  useArchiveNotification,
  useDeleteNotification,
} from "@/hooks/use-notifications";
import { useRespondConnection } from "@/hooks/use-connections";
import type { Notification, NotificationType } from "@/hooks/use-notifications";

const NOTIFICATION_CONFIG: Record<NotificationType, { icon: typeof MessageCircle; color: string }> =
  {
    message: { icon: MessageCircle, color: "text-learning" },
    connection_request: { icon: UserPlus, color: "text-trust" },
    connection_accepted: { icon: CheckCircle, color: "text-trust" },
    session_invite: { icon: CalendarPlus, color: "text-ai" },
    session_update: { icon: CalendarClock, color: "text-ai" },
    comment: { icon: MessageSquare, color: "text-learning" },
    mention: { icon: AtSign, color: "text-teaching" },
    endorsement: { icon: Star, color: "text-teaching" },
    achievement: { icon: Trophy, color: "text-teaching" },
    project_invite: { icon: FolderPlus, color: "text-trust" },
    project_join: { icon: Users, color: "text-trust" },
    project_post: { icon: MessageSquare, color: "text-learning" },
    role_application_accepted: { icon: BriefcaseBusiness, color: "text-trust" },
    role_application_declined: { icon: BriefcaseBusiness, color: "text-destructive" },
    follow: { icon: Heart, color: "text-warning" },
    challenge_join: { icon: Swords, color: "text-teaching" },
    challenge_complete: { icon: Flag, color: "text-trust" },
    challenge_submitted: { icon: Swords, color: "text-learning" },
    challenge_resubmitted: { icon: Swords, color: "text-learning" },
    join_approved: { icon: UserCheck, color: "text-trust" },
    join_rejected: { icon: UserX, color: "text-destructive" },
    post_report: { icon: Flag, color: "text-warning" },
    report_resolved: { icon: Flag, color: "text-trust" },
  };

const FALLBACK_CONFIG = { icon: MessageCircle, color: "text-muted-foreground" };

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface NotificationCardProps {
  notification: Notification;
  onNavigate?: (notification: Notification) => void;
}

export function NotificationCard({ notification, onNavigate }: NotificationCardProps) {
  const markAsRead = useMarkAsRead();
  const archive = useArchiveNotification();
  const deleteNotif = useDeleteNotification();
  const respondConnection = useRespondConnection();

  const config = NOTIFICATION_CONFIG[notification.type] ?? FALLBACK_CONFIG;
  const Icon = config.icon;
  const isUnread = !notification.read_at;
  const hasEntity = !!notification.entity_id;
  const isConnectionRequest = notification.type === "connection_request";

  function handleMarkRead() {
    markAsRead.mutate([notification.id], {
      onError: () => toast.error("Failed to mark as read"),
    });
  }

  function handleArchive() {
    archive.mutate(notification.id, {
      onError: () => toast.error("Failed to archive notification"),
    });
  }

  function handleDelete() {
    deleteNotif.mutate(notification.id, {
      onError: () => toast.error("Failed to delete notification"),
    });
  }

  function handleAccept() {
    if (!notification.entity_id) return;
    respondConnection.mutate(
      { id: notification.entity_id, status: "accepted" },
      {
        onSuccess: () => toast.success("Connection request accepted"),
        onError: () => toast.error("Failed to accept connection request"),
      },
    );
    onNavigate?.(notification);
  }

  function handleDecline() {
    if (!notification.entity_id) return;
    respondConnection.mutate(
      { id: notification.entity_id, status: "declined" },
      {
        onSuccess: () => toast.success("Connection request declined"),
        onError: () => toast.error("Failed to decline connection request"),
      },
    );
  }

  function handleClick() {
    if (!hasEntity && !isConnectionRequest) return;
    if (isUnread)
      markAsRead.mutate([notification.id], {
        onError: () => toast.error("Failed to mark as read"),
      });
    onNavigate?.(notification);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === "") {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <div
      role={isConnectionRequest ? "article" : "button"}
      tabIndex={isConnectionRequest ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group relative flex items-start gap-3 rounded-xl border p-4 transition-all duration-200 ${
        isUnread
          ? "border-l-2 border-l-primary border-border/40 bg-surface-elevated/50"
          : "border-border/40 bg-surface/40 opacity-75 hover:opacity-100"
      } ${!isConnectionRequest ? "cursor-pointer hover:shadow-lifted hover:-translate-y-0.5" : ""} ${!hasEntity && !isConnectionRequest ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface ${config.color}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium text-foreground">{notification.title}</span>
        </p>
        {notification.body && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={notification.body}>
            {notification.body}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {timeAgo(notification.created_at)}
          </span>
          {!hasEntity && !isConnectionRequest && (
            <span className="text-[11px] text-muted-foreground/40 italic">No longer available</span>
          )}
          {isConnectionRequest && notification.entity_id && (
            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-trust hover:text-trust hover:bg-trust"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAccept();
                }}
              >
                <UserCheck className="mr-1 h-3 w-3" />
                Accept
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDecline();
                }}
              >
                <UserX className="mr-1 h-3 w-3" />
                Decline
              </Button>
            </div>
          )}
        </div>
      </div>

      {isUnread && (
        <div className="absolute right-12 top-4 h-2 w-2 rounded-full bg-primary animate-gentle-pulse" />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {isUnread && (
            <DropdownMenuItem onClick={handleMarkRead}>
              <Check className="mr-2 h-3.5 w-3.5" />
              Mark as read
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleArchive}>
            <Archive className="mr-2 h-3.5 w-3.5" />
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
