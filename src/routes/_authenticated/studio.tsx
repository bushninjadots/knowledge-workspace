import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import "@/components/tethyr/blocks/register-all";

export const Route = createFileRoute("/_authenticated/studio")({
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-studio-page"), "StudioRoute"),
  validateSearch: (search: Record<string, unknown>): { block?: string; section?: string } => ({
    // Deep links from the Studio view: select + reveal a specific block/section.
    block: typeof search.block === "string" && search.block.length > 0 ? search.block : undefined,
    section:
      typeof search.section === "string" && search.section.length > 0 ? search.section : undefined,
  }),
  head: () => ({
    meta: [{ title: "Customize your Studio — Tethyr" }],
  }),
});
