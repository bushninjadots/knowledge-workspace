import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () =>
    seoMeta({
      path: "/dashboard",
      title: "Dashboard",
      description:
        "Your Tethyr dashboard — projects, applications, connections, and next steps in one workspace.",
      noindex: true,
    }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-dashboard-page"), "DashboardPage"),
});
