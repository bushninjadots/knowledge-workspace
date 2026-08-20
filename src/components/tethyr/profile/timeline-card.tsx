import {
  Sparkles,
  Camera,
  ImageIcon,
  GraduationCap,
  Rocket,
  Layers,
  UserPlus,
  MessageCircle,
  History,
} from "lucide-react";
import { timeAgo } from "@/lib/time";
import { SectionCard } from "./section-card";
import type { ActivityRow } from "./types";

const KIND_META: Record<
  string,
  {
    label: (m: Record<string, unknown>) => string;
    icon: typeof Sparkles;
    tone: "green" | "purple" | "muted";
  }
> = {
  joined_tethyr: { label: () => "Joined Tethyr", icon: Sparkles, tone: "purple" },
  avatar_updated: { label: () => "Updated avatar", icon: Camera, tone: "muted" },
  banner_updated: { label: () => "Updated banner", icon: ImageIcon, tone: "muted" },
  skill_teach_added: {
    label: (m) => `Started sharing ${m.skill_name ?? "a skill"}`,
    icon: GraduationCap,
    tone: "green",
  },
  skill_learning_started: {
    label: (m) => `Started growing ${m.skill_name ?? "a skill"}`,
    icon: Sparkles,
    tone: "purple",
  },
  skill_wishlisted: {
    label: (m) => `Wishlisted ${m.skill_name ?? "a skill"}`,
    icon: Sparkles,
    tone: "muted",
  },
  project_published: {
    label: (m) => `Published project "${m.title ?? "Untitled"}"`,
    icon: Rocket,
    tone: "green",
  },
  project_joined: { label: () => "Joined a project", icon: Layers, tone: "green" },
  connection_requested: {
    label: () => "Sent a connection request",
    icon: UserPlus,
    tone: "muted",
  },
  connection_received: {
    label: () => "Received a connection request",
    icon: UserPlus,
    tone: "purple",
  },
  message_received: { label: () => "Received a message", icon: MessageCircle, tone: "muted" },
};

export function TimelineCard({ events }: { events: ActivityRow[] }) {
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Activity timeline
        </span>
      }
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your journey shows up here as you build.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-border/60 pl-6">
          {events.map((e) => {
            const meta = KIND_META[e.kind] ?? {
              label: () => e.kind.replace(/_/g, ""),
              icon: Sparkles,
              tone: "muted" as const,
            };
            const Icon = meta.icon;
            const toneCls =
              meta.tone === "green"
                ? "bg-primary/15 text-primary ring-primary/30"
                : meta.tone === "purple"
                  ? "bg-[var(--brand-purple)]/15 text-[var(--brand-purple)] ring-[var(--brand-purple)]/30"
                  : "bg-background text-muted-foreground ring-border";
            return (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-8.5 flex h-6 w-6 items-center justify-center rounded-full ring-2 ${toneCls}`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div className="flex items-center gap-2">
                  <p className="text-sm">{meta.label(e.metadata)}</p>
                  <span className="text-xs text-muted-foreground">· {timeAgo(e.created_at)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}
