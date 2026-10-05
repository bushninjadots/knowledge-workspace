import { createFileRoute, isNotFound, lazyRouteComponent } from "@tanstack/react-router";
// Public-facing Studio at /u/:handle. Anyone can view — even signed-out —
// because profiles and contribution surfaces are public. The owner can edit
// the public Studio arrangement when viewing their own handle.

// Block system — profile blocks via PageShell.

import { z } from "zod";
import { seoMeta } from "@/lib/seo";
import { fetchPublicProfile } from "./-u.$handle-data";

export const Route = createFileRoute("/u/$handle")({
  // ensureQueryData (not just prefetch) so head() can read the profile for
  // its social-preview metadata; the component's useQuery shares the cache.
  // Best-effort: a failed read falls back to generic meta, not a broken page.
  loader: async ({ params, context: { queryClient } }) =>
    // Same shape as the component's useQuery cache (same key + fn), so the
    // component hydrates from here instead of refetching. A failed read
    // returns null and head() falls back to generic meta. retry is off: a
    // structural failure (missing env) just delays the fallback the page
    // already renders.
    await queryClient
      .ensureQueryData({
        queryKey: ["public-profile", params.handle],
        queryFn: () => fetchPublicProfile(params.handle),
        staleTime: 60_000,
        retry: false,
      })
      .catch((error: unknown) => {
        // A missing person is a fact (the router's 404 page), not an outage —
        // only an unreadable catalog degrades to the soft page. Swallowing
        // notFound here turned every bad handle into a 200.
        if (isNotFound(error)) throw error;
        return null;
      }),
  // Optional, not defaulted: a default inserts `embed=false` into the search
  // output of every param-less request, and the router then rewrites the URL
  // to match — a 307 hop on every profile visit and a crawler round-trip that
  // used to shed the route's own <head>. Undefined means false at the point
  // of use, so nothing else changes.
  //
  // Deliberately NOT z.coerce.boolean(): that is Boolean() on the raw value,
  // so the string "false" coerces to true and a bookmarked /u/x?embed=false
  // renders embed mode — chrome stripped, the opposite of what was asked.
  validateSearch: z.object({
    embed: z
      .union([z.boolean(), z.literal("true"), z.literal("false")])
      .transform((v) => v === true || v === "true")
      .optional()
      .catch(undefined),
  }),
  head: ({ loaderData, params }) => {
    // loaderData is the same object fetchPublicProfile resolves to (or null).
    const p = loaderData?.profile ?? null;
    const handle = p?.handle ?? params.handle;
    const displayName = p?.display_name || null;
    // With a profile: "Priya Nair (@priya) — Tethyr". Degraded (unreadable
    // profile): "@priya — Tethyr" — never the double-@ "@priya (@priya)".
    const title = displayName ? `${displayName} (@${handle})` : `@${handle}`;
    // The bio leads when present — it is what the visitor reads first. The
    // fallback names the one thing the profile actually shows: their work.
    const bio = p?.bio?.trim();
    const description = bio
      ? bio.length > 160
        ? `${bio.slice(0, 157)}…`
        : bio
      : `${displayName ? `${displayName}'s` : `@${handle}'s`} work, projects, and collaborators on Tethyr.`;
    return seoMeta({
      path: `/u/${encodeURIComponent(params.handle)}`,
      title,
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
