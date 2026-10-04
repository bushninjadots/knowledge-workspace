import { Link } from "@tanstack/react-router";
import { Network, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createGraphEdge, createGraphNode, normalizeGraph } from "@/lib/graph-model";

export function SkillGraphSummary({
  skillName,
  peopleCount,
  projectCount,
  relatedSkills,
}: {
  skillName: string;
  peopleCount: number;
  projectCount: number;
  relatedSkills: string[];
}) {
  const skillId = `skill:${skillName.trim().toLowerCase()}`;
  const nodes = [
    createGraphNode({ id: skillId, type: "skill", label: skillName }),
    ...(peopleCount > 0
      ? [
          createGraphNode({
            id: `${skillId}:people`,
            type: "person",
            label: `${peopleCount} people`,
          }),
        ]
      : []),
    ...(projectCount > 0
      ? [
          createGraphNode({
            id: `${skillId}:projects`,
            type: "project",
            label: `${projectCount} projects`,
          }),
        ]
      : []),
    ...relatedSkills.map((name) =>
      createGraphNode({ id: `skill:${name.trim().toLowerCase()}`, type: "skill", label: name }),
    ),
  ];
  const edges = [
    ...(peopleCount > 0
      ? [createGraphEdge({ type: "demonstrated_skill", from: `${skillId}:people`, to: skillId })]
      : []),
    ...(projectCount > 0
      ? [createGraphEdge({ type: "used_in", from: skillId, to: `${skillId}:projects` })]
      : []),
    ...relatedSkills.map((name) =>
      createGraphEdge({
        type: "related_to",
        from: skillId,
        to: `skill:${name.trim().toLowerCase()}`,
      }),
    ),
  ];
  const graph = normalizeGraph({ nodes, edges });
  const connected = graph.nodes.filter((node) => node.id !== skillId);
  const [query, setQuery] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState<
    "all" | "people" | "projects" | "skills"
  >("all");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredConnected = useMemo(
    () =>
      connected.filter((node) => {
        const matchesQuery =
          normalizedQuery.length === 0 || node.label.toLowerCase().includes(normalizedQuery);
        const matchesRelationship =
          relationshipFilter === "all" ||
          (relationshipFilter === "people" && node.type === "person") ||
          (relationshipFilter === "projects" && node.type === "project") ||
          (relationshipFilter === "skills" && node.type === "skill");
        return matchesQuery && matchesRelationship;
      }),
    [connected, normalizedQuery, relationshipFilter],
  );
  if (connected.length === 0) return null;

  const hrefForNode = (node: (typeof connected)[number]) => {
    if (node.id.endsWith(":people")) return "/explore?tab=creators";
    if (node.id.endsWith(":projects")) return "/projects";
    if (node.type === "skill")
      return `/skills/${encodeURIComponent(node.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`;
    return undefined;
  };

  const groups = [
    {
      label: "Demonstrated by",
      type: "person" as const,
      edgeType: "demonstrated_skill" as const,
    },
    { label: "Used in", type: "project" as const, edgeType: "used_in" as const },
    { label: "Related skills", type: "skill" as const, edgeType: "related_to" as const },
  ]
    .map((group) => ({
      ...group,
      nodes: filteredConnected.filter(
        (node) =>
          node.type === group.type &&
          graph.edges.some(
            (edge) =>
              edge.type === group.edgeType &&
              (edge.from === skillId || edge.to === skillId) &&
              (edge.from === node.id || edge.to === node.id),
          ),
      ),
    }))
    .filter((group) => group.nodes.length > 0);

  return (
    <section aria-labelledby="skill-graph-heading" className="mt-8 border-t border-border pt-6">
      <div className="flex items-start gap-3">
        <Network className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h3 id="skill-graph-heading" className="font-display text-lg font-semibold">
            {skillName} in the graph
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow the work and people connected through this skill.
          </p>
        </div>
      </div>
      <div className="mt-5 grid max-w-xl gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <label htmlFor="skill-graph-search" className="sr-only">
            Search {skillName} graph connections
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="skill-graph-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search connections"
              className="h-9 w-full rounded-md border border-border/70 bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        </div>
        <div>
          <label htmlFor="skill-graph-relationship" className="sr-only">
            Filter {skillName} graph connections
          </label>
          <Select
            value={relationshipFilter}
            onValueChange={(value) => setRelationshipFilter(value as typeof relationshipFilter)}
          >
            <SelectTrigger id="skill-graph-relationship" className="sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All connections</SelectItem>
              <SelectItem value="people">People</SelectItem>
              <SelectItem value="projects">Projects</SelectItem>
              <SelectItem value="skills">Related skills</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {filteredConnected.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground" role="status">
          No connections match “{query}”.
        </p>
      ) : (
        <div
          className="mt-5 grid gap-5 sm:grid-cols-3"
          aria-label={`${skillName} graph connections`}
        >
          {groups.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {group.label}
              </h4>
              <ul className="mt-2 flex flex-wrap gap-2">
                {group.nodes.map((node) => {
                  const href = hrefForNode(node);
                  return (
                    <li key={node.id} className="border border-border/70 px-2.5 py-1 text-xs">
                      {href ? (
                        <Link
                          to={href}
                          className="text-foreground underline-offset-4 hover:text-primary hover:underline"
                          preload="intent"
                        >
                          {node.label}
                        </Link>
                      ) : (
                        node.label
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
