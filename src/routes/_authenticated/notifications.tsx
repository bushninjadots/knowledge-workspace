import { Link, createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — Tethyr" }],
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-notifications-page"), "NotificationsPage"),
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Notifications unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unable to load notifications. Please try again.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <Link to="/dashboard">
            <Button variant="outline">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  ),
});

// Category browsing is exclusive; Needs action is the only intentional
// cross-cutting view. Both definitions live in the shared category module so
// the route and Settings cannot drift apart.
