import { Link, notFound, useParams } from "@tanstack/react-router";
import { useTeam } from "@/hooks/use-teams";
import { Skeleton } from "@/components/ui/skeleton";
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
        {/* Mirrors TeamPage: banner band, then avatar + title row and members. */}
        <div className="p-4 sm:p-8" aria-hidden="true">
          <Skeleton className="h-40 rounded-xl sm:h-56" />
          <div className="mt-4 flex items-end gap-4 px-2">
            <Skeleton className="h-24 w-24 shrink-0 rounded-full ring-4 ring-background" />
            <div className="min-w-0 flex-1 space-y-2 pb-1">
              <Skeleton className="h-8 w-2/3 sm:w-1/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-surface p-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  // An unreadable roster (outage, key-free runner) degrades to a quiet
  // inline state at 200 — throwing here turned an SSR outage into a 500
  // whose only content was the generic error page. A crew that genuinely
  // does not exist still gets the router's 404 below.
  if (isError) {
    return (
      <Shell>
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold text-foreground">This crew couldn't be loaded</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please try again in a moment.</p>
            <Link to="/teams" className="mt-4 inline-block text-sm text-primary hover:underline">
              Back to crews
            </Link>
          </div>
        </div>
      </Shell>
    );
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
