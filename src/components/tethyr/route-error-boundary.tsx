import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/**
 * Shared route-level error boundary — the single implementation behind the
 * root errorComponent and every route that overrides errorComponent with the
 * same markup. Route-level overrides exist to change the *copy* and the *back
 * destination*, not the layout.
 *
 * "Try again" invalidates the router (refetching loaders) and resets the
 * boundary; the back action is a full navigation (`<a>`), which is deliberate
 * from an error state — it recovers even when the in-app router is the thing
 * that broke.
 */
export function RouteErrorBoundary({
  error: _error,
  reset,
  title = "This page didn't load",
  description = "Something went wrong on our end. You can try refreshing or head back home.",
  backTo = "/",
  backLabel = "Go home",
}: {
  error: Error;
  reset: () => void;
  title?: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button asChild variant="outline">
            <a href={backTo}>{backLabel}</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
