import { Sparkles, Image as ImageIcon, GraduationCap, BookOpen, Star, Rocket, User } from "lucide-react";
import type { ActivityRow } from "@/hooks/use-current-user";
import { EmptyState } from "./empty-state";

const ICONS: Record<string, typeof Sparkles> = {
  joined_tethyr: Sparkles,
  avatar_updated: User,
  banner_updated: ImageIcon,
  skill_teach_added: GraduationCap,
  skill_learning_started: BookOpen,
  skill_wishlisted: Star,
  project_published: Rocket,
};

const LABELS: Record<string, (m: Record<string, unknown>) => string> = {
  joined_tethyr: () => "Joined Tethyr",
  avatar_updated: () => "Updated profile photo",
  banner_updated: () => "Updated banner",
  skill_teach_added: (m) => `Added teaching skill · ${m.skill_name ?? "skill"}`,
  skill_learning_started: (m) => `Started learning · ${m.skill_name ?? "skill"}`,
  skill_wishlisted: (m) => `Wishlisted · ${m.skill_name ?? "skill"}`,
  project_published: (m) => `Published project · ${m.title ?? "untitled"}`,
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

export function ActivityTimeline({ events, limit }: { events: ActivityRow[]; limit?: number }) {
  const rows = limit ? events.slice(0, limit) : events;
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
        const label = (LABELS[e.kind] ?? (() => e.kind.replaceAll("_", " ")))(e.metadata ?? {});
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface-elevated ring-1 ring-border/70">
              <Icon className="h-3 w-3 text-primary" />
            </span>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-foreground">{label}</p>
              <p className="shrink-0 text-xs text-muted-foreground">{relative(e.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
