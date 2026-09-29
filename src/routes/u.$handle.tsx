import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
// Public-facing Studio at /u/:handle. Anyone can view — even signed-out —
// because profiles and contribution surfaces are public. The owner can edit
// the public Studio arrangement when viewing their own handle.

// Block system — profile blocks via PageShell.

import { z } from "zod";
import { seoMeta } from "@/lib/seo";
import "@/components/tethyr/blocks/register-all";
import { fetchPublicProfile } from "./-u.$handle-data";

export const Route = createFileRoute("/u/$handle")({
  // ensureQueryData (not just prefetch) so head() can read the profile for
  // its social-preview metadata; the component's useQuery shares the cache.
  // Best-effort: a failed read falls back to generic meta, not a broken page.
  loader: async ({ params, context: { queryClient } }) =>
    // Same shape as the component's useQuery cache (same key + fn), so the
    // component hydrates from here instead of refetching. A failed read
    // returns null and head() falls back to generic meta.
    await queryClient
      .ensureQueryData({
        queryKey: ["public-profile", params.handle],
        queryFn: () => fetchPublicProfile(params.handle),
        staleTime: 60_000,
      })
      .catch(() => null),
  // Optional, not defaulted: a default inserts `embed=false` into the search
  // output of every param-less request, and the router then rewrites the URL
  // to match — a 307 hop on every profile visit and a crawler round-trip that
  // used to shed the route's own <head>. Undefined means false at the point
  // of use, so nothing else changes.
  validateSearch: z.object({
    embed: z.coerce.boolean().optional(),
  }),
  head: ({ loaderData, params }) => {
    // loaderData is the same object fetchPublicProfile resolves to (or null).
    const p = loaderData?.profile ?? null;
    const handle = p?.handle ?? params.handle;
    const name = p?.display_name || `@${handle}`;
    // The bio leads when present — it is what the visitor reads first. The
    // fallback names the one thing the profile actually shows: their work.
    const bio = p?.bio?.trim();
    const description = bio
      ? bio.length > 160
        ? `${bio.slice(0, 157)}…`
        : bio
      : `${name}'s work, projects, and collaborators on Tethyr.`;
    return seoMeta({
      path: `/u/${encodeURIComponent(params.handle)}`,
      title: `${name} (@${handle})`,
      description,
      type: "profile",
    });
  },
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
