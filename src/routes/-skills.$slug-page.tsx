import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Folder, Star, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl } from "@/components/tethyr/segmented-control";
import { SectionShell } from "@/components/tethyr/section-shell";
import { fetchSkillBySlug, skillQueryKey } from "./-skills.$slug-data";
import { useHubStats } from "./-skills.$slug-queries";
import {
  CATEGORY_BADGES,
  WORKSHOP_ICONS,
  formatSummary,
  SkillOverview,
  SkillPeople,
  SkillProjects,
} from "./-skills.$slug-sections";

type TabId = "overview" | "people" | "projects";

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: Star },
  { id: "people", label: "People", icon: Users },
  { id: "projects", label: "Projects", icon: Folder },
];

export function SkillPage() {
  const { slug } = useParams({ from: "/skills/$slug" });
  const [tab, setTab] = useState<TabId>("overview");

  const { data: skill, isLoading: skillLoading } = useQuery({
    queryKey: skillQueryKey(slug),
    queryFn: () => fetchSkillBySlug(slug),
    staleTime: 5 * 60 * 1000,
  });

  // Kept outside the early returns so hook order stays stable while the skill
  // loads; disabled until we know the id.
  const stats = useHubStats(skill?.id);

  if (skillLoading) {
    return (
      <Shell>
        <div className="mx-auto max-w-5xl p-8">
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Shell>
    );
  }

  if (!skill) {
    return (
      <Shell>
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold text-foreground">Skill not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn&apos;t find a hub for &ldquo;{slug}&rdquo; yet.
            </p>
            <Link to="/explore" className="mt-4 inline-block text-sm text-primary hover:underline">
              Back to explore
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const categoryBadge = CATEGORY_BADGES[skill.category] ?? CATEGORY_BADGES["Creative"];
  const WorkshopIcon = WORKSHOP_ICONS[Math.abs(skill.name.charCodeAt(0)) % WORKSHOP_ICONS.length];

  return (
    <Shell>
      <div className="animate-room-enter mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
        {/* Header — the frame's Back button handles going back */}
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <WorkshopIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">{skill.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${categoryBadge.color}`}
              >
                <categoryBadge.icon className="h-2.5 w-2.5" />
                {skill.category}
              </span>
              <span className="text-xs text-muted-foreground">Hub</span>
            </div>
            {stats.data && (
              <p className="mt-1 text-xs font-medium tabular-nums text-muted-foreground">
                {formatSummary(stats.data)}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Tabs — Skill hub sections */}
        <div className="relative">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            ariaLabel="Skill hub sections"
            options={TABS.map((t) => ({
              value: t.id,
              label: t.label,
              icon: t.icon,
              ariaLabel: t.label,
              id: `skill-tab-${t.id}`,
              ariaControls: `skill-panel-${t.id}`,
              hideLabelOnMobile: true,
            }))}
          />
          <div className="mt-2 h-px bg-border/40" />
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <div id="skill-panel-overview" role="tabpanel" aria-labelledby="skill-tab-overview">
            <h2 className="sr-only">Overview</h2>
            <SkillOverview
              skillId={skill.id}
              skillName={skill.name}
              description={skill.description}
              tools={skill.tools ?? []}
              stats={stats.data}
              onShowPeople={() => setTab("people")}
              onShowProjects={() => setTab("projects")}
            />
          </div>
        )}
        {tab === "people" && (
          <div id="skill-panel-people" role="tabpanel" aria-labelledby="skill-tab-people">
            <h2 className="sr-only">People</h2>
            <SkillPeople skillId={skill.id} skillName={skill.name} />
          </div>
        )}
        {tab === "projects" && (
          <div id="skill-panel-projects" role="tabpanel" aria-labelledby="skill-tab-projects">
            <h2 className="sr-only">Projects</h2>
            <SkillProjects skillId={skill.id} skillName={skill.name} />
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SectionShell backTo="/skills" className="bg-noise">
      {children}
    </SectionShell>
  );
}
