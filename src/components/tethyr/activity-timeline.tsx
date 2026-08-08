// Activity timeline — shows both activity_events and contribution_log entries
// in a unified, chronologically sorted view.
import { memo } from "react";
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
};

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
  events: staticEvents,
  limit,
}: {
  profileId?: string;
  events?: { id: string; kind: string; metadata: Record<string, unknown>; created_at: string }[];
  limit?: number;
}) {
  // If no profileId, use static events only (backward compatible)
  const { data: contributionEvents } = useQuery({
    queryKey: ["contribution-log", profileId ?? "none"],
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!profileId) return [];
      const { data } = await (supabase as any)
        .from("contribution_log")
        .select("id, action, points, metadata, created_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []).map((row: any) => ({
        id: row.id,
        kind: row.action,
        metadata: { ...row.metadata, points: row.points },
        created_at: row.created_at,
        source: "contribution" as const,
      }));
    },
    staleTime: 30_000,
    enabled: !!profileId,
  });

  // Merge and deduplicate
  const allEvents: ActivityEvent[] = [
    ...(staticEvents ?? []).map((e) => ({ ...e, source: "activity" as const })),
    ...(contributionEvents ?? []),
  ];

  // Deduplicate by kind+created_at window (within 1 second)
  const seen = new Set<string>();
  const deduped = allEvents.filter((e) => {
    const key = `${e.kind}-${Math.round(new Date(e.created_at).getTime() / 1000)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort newest first
  deduped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const rows = limit ? deduped.slice(0, limit) : deduped;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title="No activity yet"
        description="Your history builds automatically as you edit your profile, add skills, and publish projects."
      />
    );
  }

  return (
    <ol className="relative space-y-4 pl-6">
      <span className="absolute left-[10px] top-2 bottom-2 w-px bg-border/70" aria-hidden />
      {rows.map((e) => {
        const Icon = ICONS[e.kind] ?? Sparkles;
        const label = (LABELS[e.kind] ?? (() => e.kind.replaceAll("_", "")))(e.metadata ?? {});
        const points = (e.metadata as any)?.points as number | undefined;
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface-elevated ring-1 ring-border/70">
              <Icon className="h-3 w-3 text-primary" />
            </span>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-foreground">{label}</p>
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
  );
});
