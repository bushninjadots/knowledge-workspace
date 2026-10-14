import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { seoMeta } from "@/lib/seo";

// The Tether, full size: a member's (or a project's) whole story as a
// tetherball — public, like profiles and projects.
export const Route = createFileRoute("/tether")({
  validateSearch: z.object({
    // Any 36-char id (seed and imported ids aren't always RFC 4122 v4).
    project: z
      .string()
      .regex(/^[0-9a-f-]{36}$/i)
      .optional(),
    member: z.string().min(1).max(40).optional(),
  }),
  head: () => {
    const { meta, links } = seoMeta({
      path: "/tether",
      title: "The Tether",
      description:
        "Everything a builder is connected to — projects, people, skills, crews, repos — as one living tetherball that grows with their work.",
    });
    return { meta, links };
  },
  component: lazyRouteComponent(() => import("./-tether-page"), "TetherPage"),
});
