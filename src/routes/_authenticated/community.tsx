import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { jsonLd, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => {
    const base = seoMeta({
      path: "/community",
      title: "Community",
      description: "A space where people share ideas, ask for help, and collaborate on projects.",
      noindex: true,
    });
    return {
      ...base,
      meta: [
        ...base.meta,
        ...jsonLd({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Tethyr Community",
          description:
            "Community feeds and spaces where builders share ideas, ask for help, and collaborate on projects.",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home feed" },
            { "@type": "ListItem", position: 2, name: "Help requests" },
            { "@type": "ListItem", position: 3, name: "Collaborations" },
            { "@type": "ListItem", position: 4, name: "Showcases" },
            { "@type": "ListItem", position: 5, name: "Community spaces" },
          ],
        }),
      ],
    };
  },
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-community-page"), "CommunityPage"),
});

/**
 * Thin shell for /community. Owns page-level concerns only — which view is
 * active, the mobile drawers, the deep-linked space, and the composer trigger
 * (shared by the mobile FAB and empty states). The feed, header, list, rail
 * and sidebar are extracted subcomponents that each own their own data.
 */
