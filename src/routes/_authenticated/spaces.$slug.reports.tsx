import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/spaces/$slug/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Tethyr" },
      {
        name: "description",
        content: "Review member reports and moderation history for this community.",
      },
    ],
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-spaces.$slug.reports-page"), "SpaceReportsPage"),
});
