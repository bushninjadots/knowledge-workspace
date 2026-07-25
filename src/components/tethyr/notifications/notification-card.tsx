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
  Heart,
  MoreHorizontal,
  Check,
  Archive,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useMarkAsRead,
  useArchiveNotification,
  useDeleteNotification,
} from "@/hooks/use-notifications";
import type { Notification, NotificationType } from "@/hooks/use-notifications";

const NOTIFICATION_CONFIG: Record<
  NotificationType,
  { icon: typeof MessageCircle; color: string; actionLabel: string; actionTo?: string }
> = {
  message: { icon: MessageCircle, color: "text-blue-400", actionLabel: "Reply" },
  connection_request: { icon: UserPlus, color: "text-green-400", actionLabel: "View" },
  connection_accepted: { icon: CheckCircle, color: "text-green-400", actionLabel: "View Profile" },
  session_invite: { icon: CalendarPlus, color: "text-purple-400", actionLabel: "View" },
  session_update: { icon: CalendarClock, color: "text-purple-400", actionLabel: "Join Session" },
  comment: { icon: MessageSquare, color: "text-blue-400", actionLabel: "View Thread" },
  mention: { icon: AtSign, color: "text-orange-400", actionLabel: "Reply" },
  endorsement: { icon: Star, color: "text-yellow-400", actionLabel: "View" },
  achievement: { icon: Trophy, color: "text-amber-400", actionLabel: "Celebrate" },
  project_invite: { icon: FolderPlus, color: "text-green-400", actionLabel: "View" },
  project_join: { icon: Users, color: "text-green-400", actionLabel: "View Profile" },
  follow: { icon: Heart, color: "text-pink-400", actionLabel: "Follow Back" },
};

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
  actorName?: string;
  actorAvatar?: string;
  onAction?: (notification: Notification) => void;
}

export function NotificationCard({
  notification,
  actorName,
  actorAvatar,
  onAction,
}: NotificationCardProps) {
  const markAsRead = useMarkAsRead();
  const archive = useArchiveNotification();
  const deleteNotif = useDeleteNotification();

  const config = NOTIFICATION_CONFIG[notification.type];
  const Icon = config.icon;
  const isUnread = !notification.read_at;

  function handleMarkRead() {
    markAsRead.mutate([notification.id]);
  }

  function handleArchive() {
    archive.mutate(notification.id);
  }

  function handleDelete() {
    deleteNotif.mutate(notification.id);
  }

  return (
    <div
      className={`group relative flex items-start gap-3 rounded-xl border p-4 transition-all duration-200 ${
        isUnread
          ? "border-l-2 border-l-primary border-border/40 bg-surface-elevated/50"
          : "border-border/40 bg-surface/40 opacity-75 hover:opacity-100"
      } hover:shadow-lift hover:-translate-y-0.5`}
    >
      {/* Icon */}
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface ${config.color}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium text-foreground">{notification.title}</span>
        </p>
        {notification.body && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/70">
            {timeAgo(notification.created_at)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-primary hover:text-primary/80"
            onClick={() => onAction?.(notification)}
          >
            {config.actionLabel}
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div className="absolute right-12 top-4 h-2 w-2 rounded-full bg-primary animate-gentle-pulse" />
      )}

      {/* More menu */}
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
