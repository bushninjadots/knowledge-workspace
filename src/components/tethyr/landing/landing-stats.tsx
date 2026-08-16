import {
  Boxes,
  FolderKanban,
  MessageCircle,
  MessageSquare,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { AnimatedStat, useLandingStats } from "./data";

export function LandingStats() {
  const { data: stats } = useLandingStats();
  if (
    !stats ||
    (stats.members === 0 &&
      stats.projects === 0 &&
      stats.spaces === 0 &&
      stats.skills === 0 &&
      stats.posts === 0 &&
      stats.comments === 0 &&
      stats.challenges === 0)
  ) {
    return null;
  }
  const items = [
    { value: stats.members, label: "Members", icon: Users },
    { value: stats.projects, label: "Projects", icon: FolderKanban },
    { value: stats.spaces, label: "Community spaces", icon: Boxes },
    { value: stats.skills, label: "Skills in the catalog", icon: Sparkles },
    { value: stats.posts, label: "Community posts", icon: MessageSquare },
    { value: stats.comments, label: "Comments shared", icon: MessageCircle },
    { value: stats.challenges, label: "Challenges", icon: Trophy },
  ];
  return (
    <section className="group border-y border-border/60 bg-surface/40">
      <div className="marquee-viewport overflow-hidden">
        <div className="marquee-track mx-auto flex w-max animate-marquee items-center py-8 group-hover:[animation-play-state:paused]">
          {[false, true].map((duplicate) => (
            <div
              key={duplicate ? "copy" : "original"}
              aria-hidden={duplicate}
              className="marquee-half flex items-center gap-10 pr-10"
            >
              {items.map((item) => (
                <div key={item.label} className="flex shrink-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <AnimatedStat value={item.value} />
                    <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
