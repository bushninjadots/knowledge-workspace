// Connections — your accepted friends and pending requests, in one place.
// Accepted connections link straight to a profile and a message thread.

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/connections")({
  head: () => ({
    meta: [
      { title: "Connections — Tethyr" },
      { name: "description", content: "People you're connected with on Tethyr." },
    ],
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-connections-page"), "ConnectionsPage"),
});
