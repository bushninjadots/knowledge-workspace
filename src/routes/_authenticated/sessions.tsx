import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { z } from "zod";
import { SessionsLayout } from "@/components/tethyr/sessions/sessions-layout";
import type { SessionsTab } from "@/components/tethyr/sessions/sessions-sidebar";

const SESSION_TABS: SessionsTab[] = ["upcoming", "calendar", "history", "requests", "availability"];

export const Route = createFileRoute("/_authenticated/sessions")({
  validateSearch: z.object({
    tab: z.enum(SESSION_TABS).optional(),
  }).parse,
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/explore"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
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
