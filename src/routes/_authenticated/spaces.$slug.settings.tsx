import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/spaces/$slug/settings")({
  head: () => ({
    meta: [
      { title: "Community settings — Tethyr" },
      {
        name: "description",
        content:
          "Edit your community name, description, visibility, and manage moderators and members.",
      },
      { property: "og:title", content: "Community settings — Tethyr" },
      {
        property: "og:description",
        content: "Manage your community details, visibility, and moderation team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-spaces.$slug.settings-page"), "SpaceSettingsPage"),
});
