// Public landing page. This file keeps the eager route surface (loader
// prefetch + SEO head). The page component lives in -landing-page.tsx and is
// code-split via lazyRouteComponent so the entry chunk stays small.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  fetchFeaturedProjects,
  fetchLandingStats,
  fetchRecentActivity,
} from "@/components/tethyr/landing/data";
import { absoluteUrl, jsonLd, seoMeta, SITE } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    // Prefetch the landing sections so their content streams with the SSR
    // HTML — no skeleton flash, no client refetch, and no hydration
    // mismatch when the client cache is warm on repeat visits.
    await Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: ["landing-stats"],
        queryFn: fetchLandingStats,
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ["landing-featured-projects"],
        queryFn: fetchFeaturedProjects,
        staleTime: 60_000,
      }),
      queryClient.prefetchQuery({
        queryKey: ["landing-activity"],
        queryFn: fetchRecentActivity,
        staleTime: 60_000,
      }),
    ]);
    return {};
  },
  head: () => {
    const base = seoMeta({ path: "/", title: SITE.tagline, description: SITE.description });
    const siteUrl = absoluteUrl("/");
    return {
      ...base,
      meta: [
        ...base.meta,
        ...jsonLd(
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: SITE.name,
            description: SITE.description,
            ...(siteUrl ? { url: siteUrl } : {}),
            ...(siteUrl ? { logo: `${siteUrl}og-image.png` } : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE.name,
            description: SITE.description,
            ...(siteUrl ? { url: siteUrl } : {}),
          },
        ),
      ],
    };
  },
  // Code-split: hero + sections load after the eager shell.
  component: lazyRouteComponent(() => import("./-landing-page"), "HomePage"),
});
