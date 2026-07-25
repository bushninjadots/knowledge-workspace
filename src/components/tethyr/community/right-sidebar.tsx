import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  TrendingUp,
  HandHeart,
  Handshake,
  Trophy,
  Target,
  Users,
  Sparkles,
} from "lucide-react";
import { useChallenges } from "@/hooks/use-challenges";
import { Badge } from "@/components/ui/badge";

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
          <p className="px-1 text-xs text-muted-foreground">No active challenges yet.</p>
        ) : (
          challenges.slice(0, 3).map((challenge) => (
            <Link
              key={challenge.id}
              to="/challenges/$id"
              params={{ id: challenge.id }}
              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-surface-elevated/40 hover:bg-surface-elevated transition-colors text-xs group"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {challenge.title}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="capitalize">{challenge.difficulty}</span>
                  <span>•</span>
                  <span>{challenge.participant_count ?? 0} joined</span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                {challenge.type}
              </Badge>
            </Link>
          ))
        )}
      </SidebarCard>

      <SidebarCard
        title="Trending skills"
        icon={<TrendingUp className="h-3.5 w-3.5 text-brand-green" />}
      >
        <p className="px-1 text-xs text-muted-foreground">No trending data yet.</p>
      </SidebarCard>

      <SidebarCard
        title="People looking for help"
        icon={<HandHeart className="h-3.5 w-3.5 text-primary" />}
      >
        <p className="px-1 text-xs text-muted-foreground">No help requests yet.</p>
      </SidebarCard>

      <SidebarCard
        title="Active collaboration requests"
        icon={<Handshake className="h-3.5 w-3.5 text-brand-purple" />}
      >
        <p className="px-1 text-xs text-muted-foreground">No collaboration requests yet.</p>
      </SidebarCard>

      <SidebarCard
        title="Learning milestones"
        icon={<Target className="h-3.5 w-3.5 text-primary" />}
      >
        <p className="px-1 text-xs text-muted-foreground">No milestones yet.</p>
      </SidebarCard>

      <SidebarCard
        title="Popular communities"
        icon={<Users className="h-3.5 w-3.5 text-brand-purple" />}
      >
        <p className="px-1 text-xs text-muted-foreground">No communities yet.</p>
      </SidebarCard>

      <SidebarCard
        title="Recommended for you"
        icon={<Sparkles className="h-3.5 w-3.5 text-brand-green" />}
      >
        <p className="px-1 text-xs text-muted-foreground">No recommendations yet.</p>
      </SidebarCard>
    </aside>
  );
}
