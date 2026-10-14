import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ships")({
  head: () => ({
    meta: [
      { title: "Ship log — Tethyr" },
      {
        name: "description",
        content:
          "Every week, builders post what they shipped. Tethyr drafts yours from GitHub — you edit and post.",
      },
    ],
  }),
  // Code-split: the page component loads after the eager route surface.
  component: lazyRouteComponent(() => import("./-ships-page"), "ShipsPage"),
});
