import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/tethyr/route-error-boundary";
import "@/components/tethyr/blocks/register-all";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Studio — Tethyr" },
      {
        name: "description",
        content: "Manage your skills, projects, and collaborative presence on Tethyr.",
      },
    ],
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-profile-page"), "ProfilePage"),
  errorComponent: ({ reset }) => (
    <RouteErrorBoundary
      error={new Error("studio failed to load")}
      reset={reset}
      title="Studio failed to load"
      description="Something went wrong while loading your studio. Please try again."
      backTo="/profile"
      backLabel="Try again from the start"
    />
  ),
});
