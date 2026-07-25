import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { TrendingUp, HandHeart, Handshake, Trophy, Target, Sparkles, Plus } from "lucide-react";
import { useChallenges } from "@/hooks/use-challenges";
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
    <div className="card-border rounded-3xl border bg-surface/80 p-4 backdrop-blur-sm">
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
          <p className="text-xs text-muted-foreground">Need a hand or mentoring on a project?</p>
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
        <div className="flex items-center gap-1.5 flex-wrap">
          {["React", "TypeScript", "UI/UX", "Python", "Tailwind"].map((skill) => (
            <Link key={skill} to="/skills/$slug" params={{ slug: skill.toLowerCase() }}>
              <Badge variant="secondary" className="text-xs px-2 py-0.5 hover:bg-secondary">
                #{skill}
              </Badge>
            </Link>
          ))}
        </div>
      </SidebarCard>

      <SidebarCard title="Learning Goals" icon={<Target className="h-3.5 w-3.5 text-primary" />}>
        <p className="px-1 text-xs text-muted-foreground">
          Set your learning goals in your profile to find matching mentors.
        </p>
      </SidebarCard>
    </aside>
  );
}
