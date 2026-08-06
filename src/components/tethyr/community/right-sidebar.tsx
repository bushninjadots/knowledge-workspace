import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { TrendingUp, HandHeart, Handshake, Trophy, Target, Sparkles, Plus } from "lucide-react";
import { useChallenges } from "@/hooks/use-challenges";
import { useTrendingSkills } from "@/hooks/use-current-user";
import type { DiscoverableSkill } from "@/hooks/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    <div className="rounded-xl border card-border bg-surface p-4">
      <p className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </p>
      <div className="mt-3 flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

export function CommunityRightSidebar({ mobile = false }: { mobile?: boolean }) {
  const { data: challenges = [] } = useChallenges("active");
  const { data: trendingSkills = [], isLoading: isLoadingSkills } = useTrendingSkills();

  return (
    <aside
      className={`${mobile ? "flex flex-col gap-4" : "hidden w-72 shrink-0 flex-col gap-4 xl:flex"}`}
    >
      <SidebarCard
        title="Active Challenges"
        icon={<Trophy className="h-3.5 w-3.5 text-brand-green" />}
      >
        {challenges.length === 0 ? (
          <div className="p-3 rounded-2xl border border-dashed border-border/60 bg-surface/40 text-center space-y-2">
            <p className="text-xs text-muted-foreground">No active challenges yet.</p>
            <Button size="sm" variant="outline" asChild className="text-xs h-7 px-2.5">
              <Link to="/community">Explore Feed</Link>
            </Button>
          </div>
        ) : (
          challenges.slice(0, 3).map((challenge) => (
            <Link
              key={challenge.id}
              to="/challenges/$id"
              params={{ id: challenge.id }}
              className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-elevated/40 hover:bg-surface-elevated transition-colors text-xs group"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {challenge.title}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="capitalize">{challenge.difficulty}</span>
                  <span>•</span>
                  <span>{challenge.participant_count ?? 0} joined</span>
                </div>
              </div>
              <Badge variant="outline" className="text-xs px-2 py-0 shrink-0">
                {challenge.type}
              </Badge>
            </Link>
          ))
        )}
      </SidebarCard>

      <SidebarCard
        title="People Looking for Help"
        icon={<HandHeart className="h-3.5 w-3.5 text-primary" />}
      >
        <div className="p-3 rounded-2xl border border-dashed border-border/60 bg-surface/40 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Need a hand or guidance on a project?</p>
          <Button size="sm" variant="outline" asChild className="text-xs h-7 px-2.5 gap-1">
            <Link to="/community">
              <Plus className="h-3 w-3" /> Post Help Request
            </Link>
          </Button>
        </div>
      </SidebarCard>

      <SidebarCard
        title="Active Collaborations"
        icon={<Handshake className="h-3.5 w-3.5 text-brand-purple" />}
      >
        <div className="p-3 rounded-2xl border border-dashed border-border/60 bg-surface/40 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Looking for teammates to build together?</p>
          <Button size="sm" variant="outline" asChild className="text-xs h-7 px-2.5 gap-1">
            <Link to="/explore">
              <Sparkles className="h-3 w-3" /> Find Projects
            </Link>
          </Button>
        </div>
      </SidebarCard>

      <SidebarCard
        title="Trending Skills"
        icon={<TrendingUp className="h-3.5 w-3.5 text-brand-green" />}
      >
        {isLoadingSkills ? (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={index}
                className="h-5 w-16 animate-pulse rounded-full bg-surface-elevated"
              />
            ))}
          </div>
        ) : trendingSkills.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            Skills will appear as the network grows.
          </p>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {trendingSkills.slice(0, 5).map((skill: DiscoverableSkill) => (
              <Link key={skill.id} to="/skills/$slug" params={{ slug: skill.slug }}>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 hover:bg-secondary">
                  #{skill.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </SidebarCard>

      <SidebarCard title="Learning Goals" icon={<Target className="h-3.5 w-3.5 text-primary" />}>
        <p className="px-1 text-xs text-muted-foreground">
          Set your growth goals in your profile to find matching collaborators.
        </p>
      </SidebarCard>
    </aside>
  );
}
