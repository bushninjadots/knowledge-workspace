import {
  createGraphEdge,
  createGraphNode,
  normalizeGraph,
  type GraphEdge,
  type GraphNode,
  type TethyrGraph,
} from "./graph-model";

export type LibraryGraphItem = {
  id: string;
  title: string;
  type: string;
  user_id: string;
  project_id?: string | null;
  github_source?: { repo?: string; path?: string; branch?: string | null } | null;
};

export type LibraryGraphOwner = {
  id: string;
  display_name?: string | null;
  handle?: string | null;
};

export type LibraryGraphProject = {
  id: string;
  title: string;
};

export type LibraryGraphTag = { id: string; name: string };

export type LibraryGraphInput = {
  item: LibraryGraphItem;
  owner?: LibraryGraphOwner | null;
  project?: LibraryGraphProject | null;
  tags?: LibraryGraphTag[];
};

function addNode(nodes: GraphNode[], node: GraphNode) {
  nodes.push(node);
}

function addEdge(edges: GraphEdge[], edge: GraphEdge) {
  edges.push(edge);
}

/** Builds the Phase 7 library graph from already-loaded item data. */
export function buildLibraryGraph(input: LibraryGraphInput): TethyrGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const itemId = `library_item:${input.item.id}`;

  addNode(
    nodes,
    createGraphNode({
      id: itemId,
      type: "library_item",
      label: input.item.title,
      metadata: { type: input.item.type },
    }),
  );

  if (input.owner) {
    const ownerId = `person:${input.owner.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: ownerId,
        type: "person",
        label: input.owner.display_name || input.owner.handle || input.owner.id,
      }),
    );
    addEdge(edges, createGraphEdge({ type: "produced", from: ownerId, to: itemId }));
  }

  if (input.project) {
    const projectId = `project:${input.project.id}`;
    addNode(
      nodes,
      createGraphNode({ id: projectId, type: "project", label: input.project.title }),
    );
    addEdge(edges, createGraphEdge({ type: "used_in", from: itemId, to: projectId }));
  }

  for (const tag of input.tags ?? []) {
    const tagId = `knowledge:${tag.id}`;
    addNode(
      nodes,
      createGraphNode({ id: tagId, type: "knowledge", label: tag.name }),
    );
    addEdge(edges, createGraphEdge({ type: "referenced_by", from: itemId, to: tagId }));
  }

  if (input.item.github_source?.repo) {
    const repoId = `repository:${input.item.github_source.repo}`;
    addNode(
      nodes,
      createGraphNode({
        id: repoId,
        type: "repository",
        label: input.item.github_source.repo,
        metadata: {
          path: input.item.github_source.path,
          branch: input.item.github_source.branch,
        },
      }),
    );
    addEdge(edges, createGraphEdge({ type: "imported_from", from: itemId, to: repoId }));
  }

  return normalizeGraph({ nodes, edges });
}

export function getLibraryGraphCounts(graph: TethyrGraph) {
  return graph.nodes.reduce<Record<string, number>>((counts, node) => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
    return counts;
  }, {});
}

export function libraryGraphHasConnections(graph: TethyrGraph) {
  return graph.nodes.some((node) => node.type !== "library_item");
}
