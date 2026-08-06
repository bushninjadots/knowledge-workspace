import { NotificationCard } from "./notification-card";
import { NotificationEmpty } from "./notification-empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification } from "@/hooks/use-notifications";

function groupByTime(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, Notification[]> = {
    Today: [],
    Yesterday: [],
    "Earlier This Week": [],
    Earlier: [],
  };

  for (const n of notifications) {
    const d = new Date(n.created_at);
    if (d >= today) {
      groups["Today"].push(n);
    } else if (d >= yesterday) {
      groups["Yesterday"].push(n);
    } else if (d >= weekAgo) {
      groups["Earlier This Week"].push(n);
    } else {
      groups["Earlier"].push(n);
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

interface NotificationFeedProps {
  notifications: Notification[];
  isLoading: boolean;
  onNavigate?: (n: Notification) => void;
}

export function NotificationFeed({ notifications, isLoading, onNavigate }: NotificationFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl border border-border/40 bg-surface/40 p-4"
          >
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return <NotificationEmpty />;
  }

  const groups = groupByTime(notifications);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-3 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </span>
            <Separator className="flex-1" />
          </div>
          <div className="space-y-2">
            {group.items.map((n) => (
              <NotificationCard key={n.id} notification={n} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
