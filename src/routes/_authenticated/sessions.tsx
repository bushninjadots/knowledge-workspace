import { createFileRoute } from "@tanstack/react-router";
import { SessionsLayout } from "@/components/tethyr/sessions/sessions-layout";

export const Route = createFileRoute("/_authenticated/sessions")({
  head: () => ({
    meta: [
      { title: "Sessions — Tethyr" },
      { name: "description", content: "Manage your skill exchanges, mentoring, and meetings." },
    ],
  }),
  component: SessionsPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
});

function SessionsPage() {
  return <SessionsLayout />;
}
