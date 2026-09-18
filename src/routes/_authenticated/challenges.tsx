import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/challenges")({
  head: () => ({
    meta: [
      { title: "Challenges — Tethyr" },
      {
        name: "description",
        content:
          "Discover and join challenges to level up your skills, build projects, and earn reputation.",
      },
    ],
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-challenges-page"), "ChallengesPage"),
});
