import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { SessionsLayout } from "@/components/tethyr/sessions/sessions-layout";

export const Route = createFileRoute("/_authenticated/sessions")({
  head: () => ({
    meta: [
      { title: "Sessions — Tethyr" },
      { name: "description", content: "Manage your collaborations, mentoring, and meetings." },
    ],
  }),
  component: SessionsPage,
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Please try again.
        </p>
      </div>
    </div>
  ),
});

function SessionsPage() {
  const { location } = useRouterState();
  const isChildRoute = location.pathname.startsWith("/sessions/");

  // `/sessions/$id` is a nested child route — render its detail page here
  // instead of the list (same pattern as /library).
  if (isChildRoute) {
    return <Outlet />;
  }

  return <SessionsLayout />;
}
