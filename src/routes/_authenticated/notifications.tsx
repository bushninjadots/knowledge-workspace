import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/tethyr/route-error-boundary";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — Tethyr" }],
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-notifications-page"), "NotificationsPage"),
  errorComponent: ({ reset }) => (
    <RouteErrorBoundary
      error={new Error("notifications failed to load")}
      reset={reset}
      title="Notifications unavailable"
      description="Unable to load notifications. Please try again."
      backTo="/dashboard"
      backLabel="Go to Dashboard"
    />
  ),
});

// Category browsing is exclusive; Needs action is the only intentional
// cross-cutting view. Both definitions live in the shared category module so
// the route and Settings cannot drift apart.
