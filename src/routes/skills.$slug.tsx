// Skill ecosystem page at /skills/:slug. Each skill becomes a creative
// workshop — a dedicated learning space with teachers, learners, and projects.

import { Link, createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { absoluteUrl, jsonLd, seoMeta, SITE } from "@/lib/seo";

export const Route = createFileRoute("/skills/$slug")({
  head: ({ params }) => {
    const base = seoMeta({
      path: `/skills/${encodeURIComponent(params.slug)}`,
      title: `${params.slug} skill hub`,
      description: `Explore ${params.slug} on Tethyr — find people sharing, growing, and discover projects built with it.`,
    });
    const skillUrl = absoluteUrl(`/skills/${encodeURIComponent(params.slug)}`);
    return {
      ...base,
      meta: [
        ...base.meta,
        ...jsonLd({
          "@context": "https://schema.org",
          "@type": "Course",
          name: `${params.slug} — Tethyr skill hub`,
          description: `Explore ${params.slug} on Tethyr — find people sharing, growing, and discover projects.`,
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
  // (loader/head/beforeLoad) so the entry chunk stays small.
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
