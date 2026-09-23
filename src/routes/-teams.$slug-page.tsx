import { notFound, useParams } from "@tanstack/react-router";
import { useTeam } from "@/hooks/use-teams";
import { TeamPage } from "@/components/tethyr/team/team-page";
import { SectionShell } from "@/components/tethyr/section-shell";

// Code-split module: the interactive page for its route. See the route
// file for the eager surface (loader/head) and the lazyRouteComponent wire-up.
export function TeamRoute() {
  const { slug } = useParams({ from: "/teams/$slug" });
  const { data, isLoading, isError } = useTeam(slug);

  if (isLoading) {
    return (
      <Shell>
        <div className="animate-gentle-pulse space-y-6 p-8" aria-hidden="true">
          <div className="h-24 rounded-xl bg-surface" />
          <div className="h-8 w-2/3 rounded bg-surface" />
          <div className="h-4 w-1/2 rounded bg-surface" />
        </div>
      </Shell>
    );
  }

  if (isError) {
    throw new Error("Team failed to load");
  }
  if (!data) throw notFound();

  return (
    <Shell>
      <TeamPage team={data.team} members={data.members} projects={data.projects} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <SectionShell>{children}</SectionShell>;
}
