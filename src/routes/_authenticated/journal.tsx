import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Dev journal — Tethyr" },
      {
        name: "description",
        content:
          "Log as you work. Tethyr turns it into your standup, your weekly ship and your monthly brag doc.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("./-journal-page"), "JournalPage"),
});
