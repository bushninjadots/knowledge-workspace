import {
  createGraphEdge,
  createGraphNode,
  normalizeGraph,
  type GraphEdge,
  type GraphNode,
  type TethyrGraph,
} from "./graph-model";

type ProjectGraphProject = {
  id: string;
  title: string;
  description?: string | null;
  visibility?: "public" | "private";
  profile_id?: string | null;
  status?: string | null;
  stage?: string | null;
};

type ProjectGraphContributor = {
  profile_id: string;
  role?: string | null;
  profile?: { display_name?: string | null; handle?: string | null } | null;
  skills_used?: string[] | null;
};

type ProjectGraphSkill = { id?: string; name: string };
type ProjectGraphMilestone = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
};
type ProjectGraphRole = {
  id: string;
  title: string;
  is_filled?: boolean;
  filled_by?: string | null;
};
type ProjectGraphRepository = {
  id: string;
  name: string;
  url?: string | null;
  provider?: string | null;
  importedAt?: string | null;
};
type ProjectGraphDiscussion = { id: string; title: string };
type ProjectGraphNeed = { id: string; title: string };
type ProjectGraphContribution = {
  id: string;
  label: string;
  description?: string | null;
  authorProfileId?: string | null;
  date?: string | null;
  evidence?: string | null;
};
/** The project this one was forked from, resolved to just its identity. */
type ProjectGraphLineage = {
  id: string;
  title: string;
  description?: string | null;
  relationship?: "forked_from" | "related_to" | "derived_from";
};

type ProjectGraphHistoryEntry = {
  id: string;
  label: string;
  description?: string | null;
  date?: string | null;
  kind?: "milestone" | "contribution";
};

export type ProjectGraphInput = {
  project: ProjectGraphProject;
  contributors?: ProjectGraphContributor[];
  skills?: ProjectGraphSkill[];
  milestones?: ProjectGraphMilestone[];
  roles?: ProjectGraphRole[];
  repositories?: ProjectGraphRepository[];
  discussions?: ProjectGraphDiscussion[];
  needs?: ProjectGraphNeed[];
  contributions?: ProjectGraphContribution[];
  forkedFrom?: ProjectGraphLineage | null;
  relatedProjects?: ProjectGraphLineage[];
  /** Chronological project events rendered as first-class graph nodes. */
  history?: ProjectGraphHistoryEntry[];
};

/** Minimal shape of a `project_activity` row needed to shape graph inputs. */
export type ProjectActivityLike = {
  id: string;
  kind: string;
  title: string;
  body?: string | null;
  actor_id?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

const CONTRIBUTION_ACTIVITY_KINDS = new Set(["contribution", "weekly_prompt"]);

/** Minimal shape of a `contribution_log` row needed to shape graph inputs. */
export type ProjectContributionLogEntry = {
  id: string;
  action: string;
  profile_id?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

/** Readable label for a credited contribution action. */
function contributionLabel(action: string, metadata?: Record<string, unknown> | null): string {
  switch (action) {
    case "project_published":
      return `Published ${typeof metadata?.title === "string" ? metadata.title : "the project"}`;
    case "project_joined":
      return "Joined the project";
    case "project_update_posted":
      return "Posted an update";
    case "milestone_completed":
      return typeof metadata?.milestone_title === "string"
        ? `Completed milestone: ${metadata.milestone_title}`
        : "Completed a milestone";
    default:
      return action.replace(/_/g, " ");
  }
}

/** The contribution ledger (`contribution_log`) is the project's credited work
 *  history — each entry becomes a contribution node attributed to its author. */
export function projectContributionsFromLog(
  entries: ProjectContributionLogEntry[],
): ProjectGraphContribution[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: contributionLabel(entry.action, entry.metadata),
    authorProfileId: entry.profile_id,
    date: entry.created_at,
  }));
}

/** Project activity becomes dated timeline events. The "show your work"
 *  contribution entries are excluded — they are already credited contribution
 *  nodes, so rendering them again as history would double-count the event. */
export function projectHistoryFromActivity(
  rows: ProjectActivityLike[],
): ProjectGraphHistoryEntry[] {
  return rows
    .filter((row) => !CONTRIBUTION_ACTIVITY_KINDS.has(row.kind))
    .map((row) => ({
      id: row.id,
      label: row.title,
      description: row.body,
      date: row.created_at,
      kind: "milestone" as const,
    }));
}

function personLabel(contributor: ProjectGraphContributor) {
  return contributor.profile?.display_name || contributor.profile?.handle || contributor.profile_id;
}

function addNode(nodes: GraphNode[], node: GraphNode) {
  nodes.push(node);
  return node.id;
}

function addEdge(edges: GraphEdge[], edge: GraphEdge) {
  edges.push(edge);
}

/** Builds the Phase 2 project graph from already-loaded project workspace data. */
export function buildProjectGraph(input: ProjectGraphInput): TethyrGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const projectId = `project:${input.project.id}`;

  addNode(
    nodes,
    createGraphNode({
      id: projectId,
      type: "project",
      label: input.project.title,
      description: input.project.description ?? undefined,
      visibility: input.project.visibility ?? undefined,
      metadata: { status: input.project.status, stage: input.project.stage },
    }),
  );

  for (const contributor of input.contributors ?? []) {
    const personId = `person:${contributor.profile_id}`;
    addNode(
      nodes,
      createGraphNode({ id: personId, type: "person", label: personLabel(contributor) }),
    );
    addEdge(
      edges,
      createGraphEdge({
        type: contributor.role === "creator" ? "produced" : "contributed_to",
        from: personId,
        to: projectId,
        metadata: { role: contributor.role ?? undefined },
      }),
    );

    for (const skillName of contributor.skills_used ?? []) {
      const skillId = `skill:${skillName.trim().toLowerCase()}`;
      addNode(nodes, createGraphNode({ id: skillId, type: "skill", label: skillName.trim() }));
      addEdge(edges, createGraphEdge({ type: "demonstrated_skill", from: personId, to: skillId }));
      addEdge(edges, createGraphEdge({ type: "used_in", from: skillId, to: projectId }));
    }
  }

  for (const skill of input.skills ?? []) {
    const skillId = `skill:${skill.id ?? skill.name.trim().toLowerCase()}`;
    addNode(nodes, createGraphNode({ id: skillId, type: "skill", label: skill.name }));
    addEdge(edges, createGraphEdge({ type: "used_in", from: skillId, to: projectId }));
  }

  for (const milestone of input.milestones ?? []) {
    const milestoneId = `milestone:${milestone.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: milestoneId,
        type: "milestone",
        label: milestone.title,
        description: milestone.description ?? undefined,
        metadata: { status: milestone.status },
      }),
    );
    addEdge(edges, createGraphEdge({ type: "has_milestone", from: projectId, to: milestoneId }));
  }

  for (const role of input.roles ?? []) {
    const roleId = `role:${role.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: roleId,
        type: "role",
        label: role.title,
        metadata: { isFilled: role.is_filled },
      }),
    );
    addEdge(edges, createGraphEdge({ type: "has_role", from: projectId, to: roleId }));
    if (role.filled_by)
      addEdge(
        edges,
        createGraphEdge({ type: "filled_role", from: `person:${role.filled_by}`, to: roleId }),
      );
  }

  for (const repository of input.repositories ?? []) {
    const repositoryId = `repository:${repository.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: repositoryId,
        type: "repository",
        label: repository.name,
        metadata: {
          url: repository.url,
          provider: repository.provider,
          importedAt: repository.importedAt,
        },
      }),
    );
    addEdge(
      edges,
      createGraphEdge({
        type: "imported_from",
        from: projectId,
        to: repositoryId,
        metadata: {
          repositoryId: repository.id,
          provider: repository.provider,
          date: repository.importedAt ?? undefined,
        },
      }),
    );
  }

  for (const discussion of input.discussions ?? []) {
    const discussionId = `discussion:${discussion.id}`;
    addNode(
      nodes,
      createGraphNode({ id: discussionId, type: "discussion", label: discussion.title }),
    );
    addEdge(edges, createGraphEdge({ type: "contains", from: projectId, to: discussionId }));
  }

  for (const need of input.needs ?? []) {
    const needId = `need:${need.id}`;
    addNode(nodes, createGraphNode({ id: needId, type: "need", label: need.title }));
    addEdge(edges, createGraphEdge({ type: "needs", from: projectId, to: needId }));
  }

  for (const contribution of input.contributions ?? []) {
    const contributionId = `contribution:${contribution.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: contributionId,
        type: "contribution",
        label: contribution.label,
        description: contribution.description ?? undefined,
        metadata: { date: contribution.date, evidence: contribution.evidence },
      }),
    );
    addEdge(edges, createGraphEdge({ type: "produced", from: contributionId, to: projectId }));

    if (contribution.authorProfileId) {
      const authorId = `person:${contribution.authorProfileId}`;
      addNode(nodes, createGraphNode({ id: authorId, type: "person", label: authorId.slice(7) }));
      addEdge(edges, createGraphEdge({ type: "produced", from: authorId, to: contributionId }));
    }
  }

  // Fork lineage (spec §6) — a forked_from edge to a parent project node, so
  // lineage is a real relationship in the model rather than a header-only note.
  if (input.forkedFrom) {
    const parentId = `project:${input.forkedFrom.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: parentId,
        type: "project",
        label: input.forkedFrom.title,
        description: input.forkedFrom.description ?? undefined,
      }),
    );
    addEdge(edges, createGraphEdge({ type: "forked_from", from: projectId, to: parentId }));
  }

  for (const relatedProject of input.relatedProjects ?? []) {
    const relatedId = `project:${relatedProject.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: relatedId,
        type: "project",
        label: relatedProject.title,
        description: relatedProject.description ?? undefined,
      }),
    );
    addEdge(
      edges,
      createGraphEdge({
        type: relatedProject.relationship === "derived_from" ? "derived_from" : "related_to",
        from: projectId,
        to: relatedId,
      }),
    );
  }

  // History entries remain first-class nodes so a timeline can be derived from
  // the same graph without inventing a second, disconnected data model.
  for (const entry of input.history ?? []) {
    const nodeType = entry.kind ?? "milestone";
    const entryId = `${nodeType}:${entry.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: entryId,
        type: nodeType,
        label: entry.label,
        description: entry.description ?? undefined,
        metadata: { date: entry.date },
      }),
    );
    addEdge(
      edges,
      createGraphEdge({
        type: nodeType === "contribution" ? "produced" : "has_milestone",
        from: projectId,
        to: entryId,
        metadata: { date: entry.date ?? undefined },
      }),
    );
  }

  return normalizeGraph({ nodes, edges });
}
