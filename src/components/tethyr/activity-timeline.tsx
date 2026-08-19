// Activity timeline — shows both activity_events and contribution_log entries
// in a unified, chronologically sorted view.
import { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Image as ImageIcon,
  GraduationCap,
  BookOpen,
  Star,
  Rocket,
  User,
  MessageCircle,
  Flag,
  ThumbsUp,
  Users,
  Plus,
  Zap,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "./empty-state";

type ActivityEvent = {
  id: string;
  kind: string;
  metadata: Record<string, unknown>;
  created_at: string;
  source: "activity" | "contribution";
};

type ActivityGroup = ActivityEvent & { count: number; latestCreatedAt: string };

function activityIdentity(event: ActivityEvent): string {
  const entityId =
    event.metadata.skill_id ??
    event.metadata.project_id ??
    event.metadata.post_id ??
    event.metadata.comment_id ??
    event.metadata.milestone_id ??
    "";
  return `${event.kind}|${String(entityId)}`;
}

const ICONS: Record<string, typeof Sparkles> = {
  joined_tethyr: Sparkles,
  avatar_updated: User,
  banner_updated: ImageIcon,
  skill_teach_added: GraduationCap,
  skill_learning_started: BookOpen,
  skill_wishlisted: Star,
  project_published: Rocket,
  project_joined: Users,
  milestone_completed: Flag,
  endorsement_received: ThumbsUp,
  community_post_created: MessageCircle,
  community_comment_created: MessageCircle,
  project_update_posted: Plus,
  discussion_started: MessageCircle,
  discussion_reply: MessageCircle,
  connection_requested: UserPlus,
  connection_received: UserPlus,
  connection_accepted: UserPlus,
  connection_declined: UserPlus,
  message_received: MessageCircle,
};

const LABELS: Record<string, (m: Record<string, unknown>) => string> = {
  joined_tethyr: () => "Joined Tethyr",
  avatar_updated: () => "Updated profile photo",
  banner_updated: () => "Updated banner",
  skill_teach_added: (m) => `Added teaching skill · ${m.skill_name ?? "skill"}`,
  skill_learning_started: (m) => `Started learning · ${m.skill_name ?? "skill"}`,
  skill_wishlisted: (m) => `Wishlisted · ${m.skill_name ?? "skill"}`,
  project_published: (m) => `Published project · ${m.title ?? "untitled"}`,
  project_joined: () => "Joined a project",
  milestone_completed: (m) => `Completed milestone · ${m.milestone_title ?? "milestone"}`,
  endorsement_received: () => "Received a peer endorsement",
  community_post_created: () => "Created a community post",
  community_comment_created: () => "Commented on a post",
  project_update_posted: () => "Posted a project update",
  discussion_started: () => "Started a discussion",
  discussion_reply: () => "Replied to a discussion",
  connection_requested: () => "Sent a connection request",
  connection_received: () => "Received a connection request",
  connection_accepted: () => "Connection accepted",
  connection_declined: () => "Connection declined",
  message_received: () => "Received a message",
};

/** Fallback label for kinds we haven't mapped yet — never render raw keys. */
function humanizeKind(kind: string): string {
  return kind
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const ActivityTimeline = memo(function ActivityTimeline({
  profileId,
  profileIds,
  events: staticEvents,
  limit,
}: {
  profileId?: string;
  profileIds?: string[];
  events?: { id: string; kind: string; metadata: Record<string, unknown>; created_at: string }[];
  limit?: number;
}) {
  const [showAll, setShowAll] = useState(false);

  // Resolve to a single array of ids: a crew aggregates all its members, a
  // single profile passes one id, and absent both we fall back to static events.
  const ids = useMemo(
    () => (profileIds && profileIds.length > 0 ? profileIds : profileId ? [profileId] : []),
    [profileId, profileIds],
  );
  const idsKey = useMemo(() => ids.join(","), [ids]);

  const { data: contributionEvents } = useQuery({
    queryKey: ["contribution-log", idsKey || "none"],
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("contribution_log")
        .select("id, action, points, metadata, created_at")
        .in("profile_id", ids)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []).map((row) => ({
        id: row.id,
        kind: row.action,
        metadata: { ...(row.metadata as Record<string, unknown>), points: row.points },
        created_at: row.created_at,
        source: "contribution" as const,
      }));
    },
    staleTime: 30_000,
    enabled: ids.length > 0,
  });

  // Merge and deduplicate
  const allEvents: ActivityEvent[] = [
    ...(staticEvents ?? []).map((e) => ({ ...e, source: "activity" as const })),
    ...(contributionEvents ?? []),
  ];

  // Merge mirrored activity/contribution rows, then group repeated actions in a
  // rolling window. A banner iteration (or similar burst) should read as one
  // meaningful update rather than flooding the timeline.
  const sortedEvents = [...allEvents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const MIRROR_WINDOW_MS = 5 * 1000;
  const merged: ActivityEvent[] = [];
  for (const event of sortedEvents) {
    const existing = merged.find(
      (candidate) =>
        activityIdentity(candidate) === activityIdentity(event) &&
        Math.abs(new Date(candidate.created_at).getTime() - new Date(event.created_at).getTime()) <=
          MIRROR_WINDOW_MS,
    );
    if (!existing) {
      merged.push(event);
      continue;
    }
    const existingPoints = Number(existing.metadata.points ?? 0);
    const eventPoints = Number(event.metadata.points ?? 0);
    existing.metadata = {
      ...existing.metadata,
      ...event.metadata,
      ...(existingPoints || eventPoints ? { points: Math.max(existingPoints, eventPoints) } : {}),
    };
  }

  const sorted = merged;
  const GROUP_WINDOW_MS = 10 * 60 * 1000;
  const groups: ActivityGroup[] = [];
  for (const event of sorted) {
    const previous = groups.find(
      (group) =>
        activityIdentity(group) === activityIdentity(event) &&
        new Date(group.latestCreatedAt).getTime() - new Date(event.created_at).getTime() <=
          GROUP_WINDOW_MS,
    );
    if (previous) {
      previous.count += 1;
      const previousPoints = Number(previous.metadata.points ?? 0);
      const eventPoints = Number(event.metadata.points ?? 0);
      previous.metadata = {
        ...previous.metadata,
        ...event.metadata,
        ...(previousPoints || eventPoints ? { points: previousPoints + eventPoints } : {}),
      };
      continue;
    }
    groups.push({ ...event, count: 1, latestCreatedAt: event.created_at });
  }

  const rows = limit && !showAll ? groups.slice(0, limit) : groups;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title="No activity yet"
        description="Your history builds automatically as you publish projects, complete milestones, and help the community."
      />
    );
  }

  return (
    <>
      <ol className="relative space-y-4 pl-6">
        <span className="absolute left-[10px] top-2 bottom-2 w-px bg-border/70" aria-hidden />
        {rows.map((e) => {
          const Icon = ICONS[e.kind] ?? Sparkles;
          const label = (LABELS[e.kind] ?? (() => humanizeKind(e.kind)))(e.metadata ?? {});
          const points = e.metadata?.points as number | undefined;
          return (
            <li key={e.id} className="relative">
              <span className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface-elevated ring-1 ring-border/70">
                <Icon className="h-3 w-3 text-primary" />
              </span>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-foreground">
                  {label}
                  {e.count > 1 && (
                    <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                      ×{e.count}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  {points != null && points > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-brand-green/30 bg-brand-green/5 px-1.5 py-0.5 text-[11px] font-medium text-brand-green">
                      <Zap className="h-2.5 w-2.5" />+{points}
                    </span>
                  )}
                  <p className="shrink-0 text-xs text-muted-foreground">{relative(e.created_at)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {limit && !showAll && groups.length > limit && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
        >
          Show more ({groups.length - limit})
        </button>
      )}
    </>
  );
});
