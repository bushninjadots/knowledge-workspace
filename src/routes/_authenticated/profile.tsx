import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
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
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Studio failed to load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong while loading your studio. Please try again.
        </p>
        <a href="/profile" className="mt-4 inline-block text-sm text-primary hover:underline">
          Try again
        </a>
      </div>
    </div>
  ),
});
