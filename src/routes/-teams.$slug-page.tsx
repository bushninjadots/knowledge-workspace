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
        {/* Mirrors TeamPage: cover band, then the title row and member list. */}
        <div className="animate-gentle-pulse p-4 sm:p-8" aria-hidden="true">
          <div className="h-40 rounded-xl bg-surface" />
          <div className="mt-6 h-8 w-2/3 rounded bg-surface sm:w-1/3" />
          <div className="mt-3 h-4 w-1/3 rounded bg-surface" />
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-surface p-3">
                <div className="h-9 w-9 rounded-full bg-surface-elevated" />
                <div className="h-4 w-1/2 rounded bg-surface-elevated" />
              </div>
            ))}
          </div>
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
      <div className="animate-room-enter">
        <TeamPage team={data.team} members={data.members} projects={data.projects} />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <SectionShell>{children}</SectionShell>;
}
