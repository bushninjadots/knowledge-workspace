// Public-facing team (crew) page at /teams/:slug. Anyone can view; the roster
// and shipped-work list are the flagship, mirroring "work before metadata".

import { createFileRoute, lazyRouteComponent, notFound } from "@tanstack/react-router";
import { canonicalLinks } from "@/lib/seo";
import { fetchTeamData, TEAM_KEY } from "@/hooks/use-teams";

export const Route = createFileRoute("/teams/$slug")({
  loader: async ({ params, context: { queryClient } }) => {
    // Two different nulls, two different answers:
    //
    //   fetchTeamData RESOLVES null only for a crew that does not exist — a
    //   fact, and the loader throws notFound() so the router answers a real
    //   404 (throwing it from the page component instead only errors the SSR
    //   render and falls back to client rendering at 200).
    //
    //   The catalog being UNREADABLE (missing env on a key-free runner,
    //   transient Supabase outage) is an outage — the catch degrades to a
    //   soft 200 and the page renders its own states. Same contract as the
    //   profile, skills, and project routes.
    let data: Awaited<ReturnType<typeof fetchTeamData>> | undefined;
    try {
      data = await queryClient.fetchQuery({
        queryKey: TEAM_KEY(params.slug),
        queryFn: () => fetchTeamData(params.slug),
        staleTime: 15_000,
        retry: false,
      });
    } catch {
      data = undefined;
    }
    if (data === null) throw notFound();
    return { teamName: data?.team?.name ?? null };
  },
  head: ({ loaderData, params }) => ({
    meta: [
      {
        title: loaderData?.teamName ? `${loaderData.teamName} — Tethyr` : `Team — Tethyr`,
      },
      {
        name: "description",
        content: loaderData?.teamName
          ? `A crew that builds together on Tethyr: ${loaderData.teamName}.`
          : "A crew that builds together on Tethyr.",
      },
    ],
    links: canonicalLinks(`/teams/${encodeURIComponent(params.slug)}`),
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-teams.$slug-page"), "TeamRoute"),
  errorComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-destructive" role="alert">
      This crew couldn't be loaded. Please try again.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">
      No crew with that name.
    </div>
  ),
});
