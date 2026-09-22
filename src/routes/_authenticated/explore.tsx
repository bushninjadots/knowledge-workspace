// Creative Studios — discover projects, creators, and open opportunities.

export type ProjectRow = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  status: string;
  stage: string;
  tags: string[];
  progress_percent: number;
  cover_url: string | null;
  is_featured: boolean;
  looking_for_collaborators: boolean;
  looking_for_feedback: boolean;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    handle: string | null;
    display_name: string | null;
    creator_title: string | null;
    avatar_url: string | null;
    availability: string | null;
    background?: ProfileBackground | null;
  } | null;
};

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { PROJECT_CATEGORIES } from "@/data/mocks/catalog";
import { jsonLd, seoMeta } from "@/lib/seo";
import type { ProfileBackground } from "@/lib/background-themes";

export const Route = createFileRoute("/_authenticated/explore")({
  validateSearch: z.object({
    tab: z.enum(["projects", "creators", "opportunities"]).optional(),
    // Optional deep link to a project's quick-look preview: /explore?project=<id>
    project: z.string().optional(),
  }).parse,
  head: () => {
    const base = seoMeta({
      path: "/explore",
      title: "Explore",
      description:
        "Discover projects, builders, and open opportunities on Tethyr — the collaboration network where you get known for what you make.",
      noindex: true,
    });
    return {
      ...base,
      meta: [
        ...base.meta,
        ...jsonLd({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Skill discovery on Tethyr",
          description:
            "Browse creative disciplines and skills to find projects, people, and open opportunities.",
          itemListElement: PROJECT_CATEGORIES.map((category, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: category,
          })),
        }),
      ],
    };
  },
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-explore-page"), "ExplorePage"),
});
