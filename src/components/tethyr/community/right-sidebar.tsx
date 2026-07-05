import type { ReactNode } from "react";
import { TrendingUp, CheckCircle2 } from "lucide-react";
import {
  TOP_CONTRIBUTORS,
  FEATURED_PROJECTS,
  CHALLENGES,
  RECENTLY_SOLVED,
  TRENDING_TOPICS,
  SUGGESTED_COMMUNITIES,
  reputationLabel,
} from "@/lib/community-data";
import { ReputationBadgePill } from "./badges";

function SidebarCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card-border rounded-3xl border bg-surface p-4">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-3 flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

export function CommunityRightSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 xl:flex">
      <SidebarCard title="Trending topics">
        {TRENDING_TOPICS.map((t) => (
          <div key={t.label} className="flex items-center gap-2 px-1 text-sm">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-brand-green" />
            <span className="min-w-0 flex-1 truncate">{t.label}</span>
            <span className="text-[11px] text-muted-foreground">{t.posts}</span>
          </div>
        ))}
      </SidebarCard>

      <SidebarCard title="Top contributors">
        {TOP_CONTRIBUTORS.map((c) => (
          <div key={c.name} className="flex items-center gap-2.5 px-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-purple text-xs font-semibold text-background">
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{reputationLabel(c.reputation)}</p>
            </div>
            <ReputationBadgePill badge={c.badge} />
          </div>
        ))}
      </SidebarCard>

      <SidebarCard title="Featured projects">
        {FEATURED_PROJECTS.map((p) => (
          <div key={p.title} className="px-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate font-medium">{p.title}</span>
              <span className="text-[11px] text-muted-foreground">{p.progress}%</span>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{p.creator}</p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${p.progress}%` }} />
            </div>
          </div>
        ))}
      </SidebarCard>

      <SidebarCard title="Upcoming challenges">
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

      <SidebarCard title="Recently solved">
        {RECENTLY_SOLVED.map((q) => (
          <div key={q.title} className="flex items-start gap-2 px-1">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-green" />
            <div className="min-w-0">
              <p className="line-clamp-2 text-xs text-foreground/90">{q.title}</p>
              <p className="text-[11px] text-muted-foreground">by {q.solver}</p>
            </div>
          </div>
        ))}
      </SidebarCard>

      <SidebarCard title="Suggested communities">
        {SUGGESTED_COMMUNITIES.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-1 text-sm">
            <span className="truncate">{c.name}</span>
            <span className="text-[11px] text-muted-foreground">{c.members.toLocaleString()}</span>
          </div>
        ))}
      </SidebarCard>
    </aside>
  );
}
