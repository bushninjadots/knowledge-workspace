import type { ReactNode } from "react";
import { TrendingUp, HandHeart, Handshake, Trophy, Target, Users, Sparkles } from "lucide-react";

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
  return (
    <aside
      className={`${mobile ? "flex flex-col gap-4" : "hidden w-72 shrink-0 flex-col gap-4 xl:flex"}`}
    >
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
        title="Upcoming challenges"
        icon={<Trophy className="h-3.5 w-3.5 text-brand-green" />}
      >
        <p className="px-1 text-xs text-muted-foreground">No challenges yet.</p>
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
