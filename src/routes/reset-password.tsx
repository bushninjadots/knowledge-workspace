import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { canonicalLinks, robotsMeta } from "@/lib/seo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Tethyr" },
      { name: "description", content: "Set a new password for your Tethyr account." },
      ...robotsMeta(),
    ],
    links: canonicalLinks("/reset-password"),
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-reset-password-page"), "ResetPasswordPage"),
});
