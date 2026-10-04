import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type Kind = "project" | "milestone" | "update" | "contribution" | "link";

type Evidence = {
  key: string;
  kind: Kind;
  title: string;
  note: string | null;
  date: string;
  projectId: string | null;
  projectTitle: string | null;
  url: string | null;
  featured: boolean;
};

const KIND_LABEL: Record<Kind, string> = {
  project: "Shipped",
  milestone: "Milestone",
  update: "Update",
  contribution: "Contribution",
  link: "External",
};

type ShelfItem = { project_id?: string; title?: string; note?: string | null; url?: string | null };

async function fetchEvidence(profileId: string): Promise<Evidence[]> {
  const [profile, projects, milestones, updates, contribs] = await Promise.all([
    supabase.from("profiles").select("evidence_shelf").eq("id", profileId).maybeSingle(),
    supabase
      .from("projects")
      .select("id, title, description, status, is_featured, updated_at")
      .eq("profile_id", profileId)
      .limit(50),
    supabase
      .from("project_milestones")
      .select("id, title, updated_at, project_id, projects(title)")
      .eq("completed_by", profileId)
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("project_updates")
      .select("id, title, body, created_at, project_id, projects(title)")
      .eq("author_id", profileId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("project_contributors")
      .select("project_id, role, joined_at, skills_used, projects(title)")
      .eq("profile_id", profileId)
      .neq("role", "creator")
      .limit(20),
  ]);

  const out: Evidence[] = [];
  const titleOf = (row: unknown) =>
    ((row as { projects?: { title?: string } | null }).projects?.title ?? null) as string | null;

  const shelf = ((profile.data?.evidence_shelf ?? []) as unknown as ShelfItem[]).filter(
    (s) => s?.title,
  );
  const shelfProjects = new Set(shelf.map((s) => s.project_id).filter(Boolean));
  shelf.forEach((s, i) =>
    out.push({
      key: `shelf-${i}`,
      kind: s.url ? "link" : "project",
      title: s.title!,
      note: s.note ?? null,
      date: "",
      projectId: s.project_id ?? null,
      projectTitle: null,
      url: s.url ?? null,
      featured: true,
    }),
  );

  for (const p of projects.data ?? []) {
    if (p.status !== "completed" && !p.is_featured) continue;
    if (shelfProjects.has(p.id)) continue;
    out.push({
      key: `p-${p.id}`,
      kind: "project",
      title: p.title,
      note: p.description,
      date: p.updated_at,
      projectId: p.id,
      projectTitle: null,
      url: null,
      featured: p.is_featured,
    });
  }
  for (const m of milestones.data ?? [])
    out.push({
      key: `m-${m.id}`,
      kind: "milestone",
      title: m.title,
      note: null,
      date: m.updated_at,
      projectId: m.project_id,
      projectTitle: titleOf(m),
      url: null,
      featured: false,
    });
  for (const u of updates.data ?? [])
    out.push({
      key: `u-${u.id}`,
      kind: "update",
      title: u.title,
      note: u.body,
      date: u.created_at,
      projectId: u.project_id,
      projectTitle: titleOf(u),
      url: null,
      featured: false,
    });
  for (const c of contribs.data ?? [])
    out.push({
      key: `c-${c.project_id}`,
      kind: "contribution",
      title: `${c.role === "mentor" ? "Mentored" : "Contributed to"} ${titleOf(c) ?? "a project"}`,
      note: c.skills_used?.length ? c.skills_used.join(" · ") : null,
      date: c.joined_at,
      projectId: c.project_id,
      projectTitle: null,
      url: null,
      featured: false,
    });
  return out;
}

function ProfileProofOfWorkBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const limit = Number(config.limit ?? 6) || 6;
  const order = (config.order as string) ?? "featured";
  const grouped = config.groupByType === true;
  const include = (k: Kind) => config[`include_${k}`] !== false;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-proof-of-work", profileId],
    queryFn: () => fetchEvidence(profileId!),
    enabled: !!profileId,
  });

  const items = useMemo(() => {
    const list = (data ?? []).filter((e) => include(e.kind));
    list.sort((a, b) => {
      if (order === "featured" && a.featured !== b.featured) return a.featured ? -1 : 1;
      return (b.date || "9").localeCompare(a.date || "9");
    });
    return list.slice(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, order, limit, config]);

  const hasContent = items.length > 0;
  useEffect(() => {
    if (isLoading || isEditing || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [blockId, hasContent, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (!hasContent) {
    if (isEditing)
      return (
        <BlockEmptyState
          label="Proof of work"
          detail="Shipped projects, completed milestones, updates and contributions collect here."
        />
      );
    return null;
  }

  const groups: [string, Evidence[]][] = grouped
    ? (Object.keys(KIND_LABEL) as Kind[])
        .map((k) => [KIND_LABEL[k], items.filter((i) => i.kind === k)] as [string, Evidence[]])
        .filter(([, l]) => l.length > 0)
    : [["", items]];

  return (
    <div className="min-w-0">
      <h4 className="mb-3 text-sm font-medium text-foreground">Proof of work</h4>
      <div className="space-y-4">
        {groups.map(([label, list]) => (
          <section key={label || "all"}>
            {label && (
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
            )}
            <ol className="divide-y divide-border border-l-2 border-[color:var(--user-accent-border,var(--border))]">
              {list.map((e) => (
                <EvidenceRow
                  key={e.key}
                  e={e}
                  showType={!grouped}
                  showDate={config.showDates !== false}
                />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function EvidenceRow({
  e,
  showType,
  showDate,
}: {
  e: Evidence;
  showType: boolean;
  showDate: boolean;
}) {
  const title = e.url ? (
    <a href={e.url} target="_blank" rel="noreferrer" className="hover:underline">
      {e.title}
    </a>
  ) : e.projectId ? (
    <Link to="/projects/$id" params={{ id: e.projectId }} className="hover:underline">
      {e.title}
    </Link>
  ) : (
    e.title
  );
  return (
    <li className="py-2.5 pl-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-foreground">
          {e.featured && (
            <span className="mr-1.5 text-primary" aria-label="Featured">
              ★
            </span>
          )}
          {title}
        </p>
        {showDate && e.date && (
          <time className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {new Date(e.date).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </time>
        )}
      </div>
      <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        {showType && <span>{KIND_LABEL[e.kind]}</span>}
        {e.projectTitle && <span>in {e.projectTitle}</span>}
        {e.note && <span className="line-clamp-1 min-w-0">{e.note}</span>}
      </p>
    </li>
  );
}

registerBlock({
  type: "profile-proof-of-work",
  category: "people",
  label: "Proof of work",
  description: "An evidence shelf of what you've shipped, finished and contributed.",
  icon: "BadgeCheck",
  defaults: {
    limit: "6",
    order: "featured",
    groupByType: false,
    showDates: true,
    include_project: true,
    include_milestone: true,
    include_update: true,
    include_contribution: true,
    include_link: true,
  },
  fields: [
    {
      key: "order",
      label: "Order",
      type: "select",
      options: [
        { label: "Featured first", value: "featured" },
        { label: "Most recent", value: "recent" },
      ],
    },
    {
      key: "limit",
      label: "Items shown",
      type: "select",
      options: [
        { label: "3", value: "3" },
        { label: "6", value: "6" },
        { label: "10", value: "10" },
        { label: "20", value: "20" },
      ],
    },
    { key: "groupByType", label: "Group by type", type: "toggle" },
    { key: "showDates", label: "Show dates", type: "toggle" },
    { key: "include_project", label: "Shipped & featured projects", type: "toggle" },
    { key: "include_milestone", label: "Completed milestones", type: "toggle" },
    { key: "include_update", label: "Project updates", type: "toggle" },
    { key: "include_contribution", label: "Contributions to others' work", type: "toggle" },
    { key: "include_link", label: "Pinned external work", type: "toggle" },
  ],
  component: ProfileProofOfWorkBlock,
});
export { ProfileProofOfWorkBlock };
