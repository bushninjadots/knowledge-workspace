import { Network } from "lucide-react";
import {
  buildProfileGraph,
  getProfileGraphCounts,
  type ProfileGraphInput,
} from "@/lib/profile-graph";

export function ProfileGraphSummary({ input }: { input: ProfileGraphInput }) {
  const graph = buildProfileGraph(input);
  const counts = getProfileGraphCounts(graph);
  if (graph.nodes.length <= 1) return null;

  return (
    <section
      aria-labelledby="profile-graph-heading"
      className="mt-10 border-t border-border/60 pt-8"
    >
      <div className="flex items-start gap-3">
        <Network className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2
            id="profile-graph-heading"
            className="font-display text-lg font-semibold tracking-tight"
          >
            Connected work
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The projects, people, skills, and contributions that make this person&apos;s work
            legible.
          </p>
        </div>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        {counts.project ? <GraphCount label="Projects" value={counts.project} /> : null}
        {counts.person > 1 ? <GraphCount label="People" value={counts.person - 1} /> : null}
        {counts.skill ? <GraphCount label="Skills" value={counts.skill} /> : null}
        {counts.contribution ? (
          <GraphCount label="Contributions" value={counts.contribution} />
        ) : null}
        <GraphCount label="Relationships" value={graph.edges.length} />
      </dl>
    </section>
  );
}

function GraphCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
