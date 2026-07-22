import type { ReactNode } from "react";
import { TrendingUp, HandHeart, Handshake, Trophy, Target, Users, Sparkles } from "lucide-react";
import {
  TRENDING_SKILLS,
  CHALLENGES,
  COMMUNITY_MILESTONES,
  SUGGESTED_COMMUNITIES,
  SKILL_RECOMMENDATIONS,
  INITIAL_POSTS,
} from "@/lib/community-data";

function SidebarCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card-border rounded-3xl border bg-surface p-4">
      <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </p>
      <div className="mt-3 flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

export function CommunityRightSidebar({ mobile = false }: { mobile?: boolean }) {
  const helpRequests = INITIAL_POSTS.filter((p) => p.type === "help_request").slice(0, 3);
  const collabRequests = INITIAL_POSTS.filter((p) => p.type === "collaboration_request").slice(
    0,
    3,
  );

  return (
    <aside
      className={`${mobile ? "flex flex-col gap-4" : "hidden w-72 shrink-0 flex-col gap-4 xl:flex"}`}
    >
      <SidebarCard
        title="Trending skills"
        icon={<TrendingUp className="h-3.5 w-3.5 text-brand-green" />}
      >
        {TRENDING_SKILLS.map((t) => (
          <div key={t.skill} className="flex items-center gap-2 px-1 text-sm">
            <span className="min-w-0 flex-1 truncate">{t.skill}</span>
            <span className="text-[11px] text-muted-foreground">{t.posts} posts</span>
          </div>
        ))}
      </SidebarCard>

      <SidebarCard
        title="People looking for help"
        icon={<HandHeart className="h-3.5 w-3.5 text-primary" />}
      >
        {helpRequests.map((p) => (
          <div key={p.id} className="px-1">
            <p className="line-clamp-2 text-xs text-foreground/90">{p.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {p.helpRequest?.skillNeeded} · {p.helpRequest?.difficulty}
            </p>
          </div>
        ))}
      </SidebarCard>

      <SidebarCard
        title="Active collaboration requests"
        icon={<Handshake className="h-3.5 w-3.5 text-brand-purple" />}
      >
        {collabRequests.map((p) => (
          <div key={p.id} className="px-1">
            <p className="line-clamp-2 text-xs text-foreground/90">{p.title}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              Needs: {p.collaboration?.rolesNeeded.join(", ")}
            </p>
          </div>
        ))}
      </SidebarCard>

      <SidebarCard
        title="Upcoming challenges"
        icon={<Trophy className="h-3.5 w-3.5 text-brand-green" />}
      >
        {CHALLENGES.map((c) => (
          <div key={c.id} className="px-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate font-medium">{c.title}</span>
              <span className="text-[11px] text-muted-foreground">{c.timeLeft}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{c.participants} participants</p>
          </div>
        ))}
      </SidebarCard>

      <SidebarCard
        title="Learning milestones"
        icon={<Target className="h-3.5 w-3.5 text-primary" />}
      >
        {COMMUNITY_MILESTONES.map((m) => (
          <div key={m.label} className="flex items-center justify-between px-1 text-sm">
            <span className="text-muted-foreground">{m.label}</span>
            <span className="font-semibold tabular-nums">{m.value}</span>
          </div>
        ))}
      </SidebarCard>

      <SidebarCard
        title="Popular communities"
        icon={<Users className="h-3.5 w-3.5 text-brand-purple" />}
      >
        {SUGGESTED_COMMUNITIES.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-1 text-sm">
            <span className="truncate">{c.name}</span>
            <span className="text-[11px] text-muted-foreground">{c.members.toLocaleString()}</span>
          </div>
        ))}
      </SidebarCard>

      <SidebarCard
        title="Recommended for you"
        icon={<Sparkles className="h-3.5 w-3.5 text-brand-green" />}
      >
        {SKILL_RECOMMENDATIONS.map((r) => (
          <div key={r.skill} className="px-1">
            <p className="text-sm font-medium">Because you're learning {r.skill}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {r.tutorials} tutorials · {r.openQuestions} open questions · {r.projectsNeedingHelp}{" "}
              project{r.projectsNeedingHelp === 1 ? "" : "s"} needing help
            </p>
          </div>
        ))}
      </SidebarCard>
    </aside>
  );
}
