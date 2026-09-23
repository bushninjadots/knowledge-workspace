// Skill ecosystem page at /skills/:slug. Each skill becomes a creative
// workshop — a hub connecting the people sharing it, the people growing it,
// the projects using it, and the projects looking for it. The route loader
// prefetches the skill so the SEO head carries the real skill name.

import { Link, createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { absoluteUrl, jsonLd, seoMeta, SITE } from "@/lib/seo";
import { fetchSkillBySlug, skillQueryKey } from "./-skills.$slug-data";

export const Route = createFileRoute("/skills/$slug")({
  loader: async ({ params, context: { queryClient } }) => {
    const skill = await queryClient.fetchQuery({
      queryKey: skillQueryKey(params.slug),
      queryFn: () => fetchSkillBySlug(params.slug),
      staleTime: 5 * 60 * 1000,
    });
    return { skill };
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.skill?.name ?? params.slug;
    const base = seoMeta({
      path: `/skills/${encodeURIComponent(params.slug)}`,
      title: `${name} — skill hub`,
      description: `Explore ${name} on Tethyr — the people sharing it, the people growing it, and the projects built with it.`,
    });
    const skillUrl = absoluteUrl(`/skills/${encodeURIComponent(params.slug)}`);
    return {
      ...base,
      meta: [
        ...base.meta,
        ...jsonLd({
          "@context": "https://schema.org",
          "@type": "Course",
          name: `${name} — Tethyr skill hub`,
          description: `Explore ${name} on Tethyr — people sharing, people growing, and the projects built with it.`,
          ...(skillUrl ? { url: skillUrl } : {}),
          provider: {
            "@type": "Organization",
            name: SITE.name,
            ...(absoluteUrl("/") ? { url: absoluteUrl("/") } : {}),
          },
        }),
      ],
    };
  },
  // Code-split: the page component loads after the eager route surface
  // (loader/head) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-skills.$slug-page"), "SkillPage"),
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Skill not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't load this skill hub. Please try again.
        </p>
        <Link to="/explore" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to explore
        </Link>
      </div>
    </div>
  ),
});
