import { Link, notFound, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTeam } from "@/hooks/use-teams";
import { TeamPage } from "@/components/tethyr/team/team-page";

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
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 sm:px-6">
        <button
          onClick={() =>
            window.history.length > 1 ? window.history.back() : navigate({ to: "/" })
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-lift hover:text-foreground"
          aria-label="Go back"
          title="Back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <Link to="/" className="font-display text-lg font-semibold text-foreground">
          Tethyr
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">Crew</span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
