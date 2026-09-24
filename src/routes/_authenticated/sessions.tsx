const SESSION_TABS: SessionsTab[] = [
  "board",
  "upcoming",
  "calendar",
  "history",
  "requests",
  "availability",
];

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import type { SessionsTab } from "@/components/tethyr/sessions/sessions-sidebar";
import { RouteErrorBoundary } from "@/components/tethyr/route-error-boundary";

export const Route = createFileRoute("/_authenticated/sessions")({
  validateSearch: z.object({
    tab: z.enum(SESSION_TABS).optional(),
    // Deep link used by the command palette: auto-opens the schedule wizard.
    schedule: z.literal("1").optional(),
  }).parse,
  head: () => ({
    meta: [
      { title: "Sessions — Tethyr" },
      { name: "description", content: "Manage your collaborations, mentoring, and meetings." },
    ],
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-sessions-page"), "SessionsPage"),
  errorComponent: ({ reset }) => (
    <RouteErrorBoundary
      error={new Error("sessions failed to load")}
      reset={reset}
      backTo="/explore"
    />
  ),
});
