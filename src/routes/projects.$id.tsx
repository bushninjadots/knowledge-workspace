// Public-facing project workspace at /projects/:id. Anyone can view — even
// signed-out — because projects, project_contributors, project_skills,
// milestones, updates, discussions and open roles all carry public SELECT
// policies. Repository-workspace layout: compact header → sticky tab bar
// (README as homepage, with Files / Activity / People / Discussions) below.
//
// This file keeps only the eager route surface (loader + head + search
// validation). The ~900-line workspace component lives in -projects-page.tsx
// and is code-split via lazyRouteComponent so the entry chunk stays small.
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { canonicalLinks } from "@/lib/seo";

const sb = supabase;

export const Route = createFileRoute("/projects/$id")({
  // Lightweight title fetch so the SSR/meta <title> carries the real project
  // name (the component's useQuery still drives the full detail). Best-effort:
  // on any error we fall back to the generic title rather than failing the page.
  loader: async ({ params }) => {
    try {
      const { data } = await sb.from("projects").select("title").eq("id", params.id).maybeSingle();
      return { title: (data?.title ?? null) as string | null };
    } catch {
      return { title: null };
    }
  },
  head: ({ loaderData, params }) => ({
    meta: [
      {
        title: loaderData?.title ? `${loaderData.title} — Tethyr` : "Project — Tethyr",
      },
      {
        name: "description",
        content: loaderData?.title
          ? `Explore ${loaderData.title} and the work being built with Tethyr.`
          : "Explore this project and the work being built with Tethyr.",
      },
    ],
    links: canonicalLinks(`/projects/${encodeURIComponent(params.id)}`),
  }),
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  // Code-split: the ~900-line workspace component lives in -projects-page.tsx
  // so it stays out of the entry chunk. Loader/head stay eager.
  component: lazyRouteComponent(() => import("./-projects-page"), "ProjectPage"),
  errorComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-destructive" role="alert">
      This project couldn't be loaded. Please try again.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">
      No project with that ID.
    </div>
  ),
});
