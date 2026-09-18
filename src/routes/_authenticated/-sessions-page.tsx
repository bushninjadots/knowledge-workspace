import { Outlet, useRouterState } from "@tanstack/react-router";
import { SessionsLayout } from "@/components/tethyr/sessions/sessions-layout";

// Code-split module: the interactive page for its route. See the route
// file for the eager surface (loader/head) and the lazyRouteComponent wire-up.
export function SessionsPage() {
  const { location } = useRouterState();
  const isChildRoute = location.pathname.startsWith("/sessions/");

  // `/sessions/$id` is a nested child route — render its detail page here
  // instead of the list (same pattern as /library).
  if (isChildRoute) {
    return <Outlet />;
  }

  return <SessionsLayout />;
}
