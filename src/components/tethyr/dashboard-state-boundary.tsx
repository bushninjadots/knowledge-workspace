import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LogIn, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/tethyr/auth-shell";

export type DashboardStateData = {
  userId?: string | null;
} | null;

type Props = {
  data: DashboardStateData | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry: () => void;
  children: ReactNode;
};

/**
 * Owns the dashboard's top-level state contract so loading, auth, and error
 * states cannot fall through into one another as the current-user query
 * changes state.
 */
export function DashboardStateBoundary({
  data,
  isLoading,
  isError,
  error,
  onRetry,
  children,
}: Props) {
  const isAuthed = Boolean(data?.userId);

  if (!isLoading && !isError && !isAuthed) {
    return (
      <AuthShell
        title="Your workspace awaits"
        subtitle="Log in to pick up where you left off, or join Tethyr to start building in public."
        footer={
          <>
            Already a member?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </>
        }
      >
        <div className="space-y-4">
          <Button asChild variant="default" size="lg" className="w-full rounded-full">
            <Link to="/login">
              <LogIn className="mr-2 h-4 w-4" />
              Log in
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full rounded-full">
            <Link to="/signup">
              <UserRoundPlus className="mr-2 h-4 w-4" />
              Join Tethyr
            </Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">
              ← Back to home
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden w-60 shrink-0 md:block" />
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">Couldn't load your dashboard</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error?.message ?? "Something went wrong loading your data."}
            </p>
            <Button variant="outline" className="mt-4" onClick={onRetry}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden w-60 shrink-0 md:block" />
        <div className="flex-1 p-4 sm:p-8">
          <div className="space-y-4" role="status" aria-label="Loading your dashboard">
            <div className="h-24 animate-pulse rounded-xl bg-surface/60" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-surface/60" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
