// Turning Tethyr data into tether balls: a project's graph (from the existing
// buildProjectGraph) or a member's whole story — projects, the people they
// build with, skills, crews, spaces, repos and what they've shipped/learned.
import type { TethyrGraph } from "./graph-model";
import type { TetherNodeIn } from "./tether-layout";

/** A project's graph → balls (the project itself is the pole). */
export function projectTetherNodes(graph: TethyrGraph, projectId: string): TetherNodeIn[] {
  const center = `project:${projectId}`;
  const degree = new Map<string, number>();
  for (const e of graph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  return graph.nodes
    .filter((n) => n.id !== center)
    .map((n) => {
      const meta = (n.metadata ?? {}) as Record<string, unknown>;
      const at = [meta.date, meta.createdAt, meta.importedAt].find(
        (v): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v)),
      );
      const url = typeof meta.url === "string" && /^https:\/\//.test(meta.url) ? meta.url : null;
      return {
        id: n.id,
        type: n.type,
        label: n.label,
        description: n.description ?? null,
        weight: degree.get(n.id) ?? 1,
        at: at ?? null,
        href: url,
      };
    });
}

export type MemberStory = {
  projects: { id: string; title: string; created_at: string; contributions?: number }[];
  collaborators: {
    id: string;
    name: string;
    handle: string | null;
    projects: number;
    since: string | null;
  }[];
  skills: { id: string; name: string; slug: string; teach: boolean; at: string | null }[];
  crews: { id: string; name: string; slug: string; at: string | null }[];
  spaces: { id: string; name: string; slug: string; at: string | null }[];
  repos: { name: string; url: string; stars: number; at: string | null }[];
  /** Shared journal entries (learned / decided / did) and recent ships. */
  milestones: { id: string; label: string; at: string; kind: "ship" | "learned" | "built" }[];
};

/** A member's story → balls (the member is the pole). */
export function memberTetherNodes(story: MemberStory): TetherNodeIn[] {
  return [
    ...story.projects.map((p) => ({
      id: `project:${p.id}`,
      type: "project" as const,
      label: p.title,
      weight: 2 + (p.contributions ?? 0),
      at: p.created_at,
      href: `/projects/${p.id}`,
    })),
    ...story.collaborators.map((c) => ({
      id: `person:${c.id}`,
      type: "person" as const,
      label: c.name,
      weight: 1 + c.projects * 2,
      at: c.since,
      href: c.handle ? `/u/${c.handle}` : null,
      description: `${c.projects} shared project${c.projects === 1 ? "" : "s"}`,
    })),
    ...story.skills.map((s) => ({
      id: `skill:${s.id}`,
      type: "skill" as const,
      label: s.name,
      weight: s.teach ? 3 : 1,
      at: s.at,
      href: `/skills/${s.slug}`,
      description: s.teach ? "Teaches" : "Learning",
    })),
    ...story.crews.map((c) => ({
      id: `crew:${c.id}`,
      type: "organization" as const,
      label: c.name,
      weight: 3,
      at: c.at,
      href: `/teams/${c.slug}`,
    })),
    ...story.spaces.map((s) => ({
      id: `space:${s.id}`,
      type: "community" as const,
      label: s.name,
      weight: 2,
      at: s.at,
      href: `/community?space=${s.slug}`,
    })),
    ...story.repos.map((r) => ({
      id: `repo:${r.name}`,
      type: "repository" as const,
      label: r.name.split("/").pop() ?? r.name,
      weight: 1 + Math.min(8, Math.log2(1 + r.stars)),
      at: r.at,
      href: r.url,
      description: r.stars ? `★ ${r.stars}` : null,
    })),
    ...story.milestones.map((m) => ({
      id: `moment:${m.id}`,
      type: "knowledge" as const,
      label: m.label,
      weight: m.kind === "ship" ? 2 : 1,
      at: m.at,
      description: m.kind === "ship" ? "Shipped" : m.kind === "learned" ? "Learned" : "Built",
    })),
  ];
}
