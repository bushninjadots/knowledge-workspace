import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
// Public-facing Studio at /u/:handle. Anyone can view — even signed-out —
// because profiles and contribution surfaces are public. The owner can edit
// the public Studio arrangement when viewing their own handle.

// Block system — profile blocks via PageShell.

import { z } from "zod";
import { canonicalLinks } from "@/lib/seo";
import "@/components/tethyr/blocks/register-all";
import { fetchPublicProfile } from "./-u.$handle-data";

export const Route = createFileRoute("/u/$handle")({
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.prefetchQuery({
      queryKey: ["public-profile", params.handle],
      queryFn: () => fetchPublicProfile(params.handle),
      staleTime: 60_000,
    });
    return {};
  },
  validateSearch: z.object({
    embed: z.coerce.boolean().optional().default(false),
  }),
  head: ({ params }) => ({
    meta: [
      { title: `@${params.handle} — Tethyr` },
      {
        name: "description",
        content: `Explore @${params.handle}'s work, skills, and projects on Tethyr.`,
      },
    ],
    links: canonicalLinks(`/u/${encodeURIComponent(params.handle)}`),
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-u.$handle-page"), "PublicProfileRoute"),
  errorComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-destructive" role="alert">
      This person's studio couldn't be loaded. Please try again.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">
      No person with that handle.
    </div>
  ),
});
