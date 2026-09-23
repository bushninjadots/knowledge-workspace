// Public-facing team (crew) page at /teams/:slug. Anyone can view; the roster
// and shipped-work list are the flagship, mirroring "work before metadata".

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { canonicalLinks } from "@/lib/seo";
import { fetchTeamData, TEAM_KEY } from "@/hooks/use-teams";

export const Route = createFileRoute("/teams/$slug")({
  loader: async ({ params, context: { queryClient } }) => {
    const data = await queryClient.fetchQuery({
      queryKey: TEAM_KEY(params.slug),
      queryFn: () => fetchTeamData(params.slug),
      staleTime: 15_000,
    });
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
