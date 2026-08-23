// ── Creativity Studio ────────────────────────────────────────────────────────
// Route: /studio
// The dedicated editing environment for Tethyr profiles and projects.
// Three-column layout: left (blocks/templates/themes), center (live canvas),
// right (properties/design inspector). Shared architecture for both profiles
// and projects.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Studio } from "@/components/tethyr/studio/studio";

// Block registration side-effect imports — must be imported so the block
// registry is populated before createBlockInstance() is called.
import "@/components/tethyr/blocks/content";
import "@/components/tethyr/blocks/project";
import "@/components/tethyr/blocks/profile";

export const Route = createFileRoute("/_authenticated/studio")({
  component: StudioRoute,
  head: () => ({
    meta: [{ title: "Creativity Studio — Tethyr" }],
  }),
});

function StudioRoute() {
  const { data: me, isLoading: meLoading } = useCurrentUser();

  // Fetch the user's profile and projects for the studio picker.
  const { data: studioData, isLoading: dataLoading } = useQuery({
    queryKey: ["studio-data", me?.userId],
    queryFn: async () => {
      if (!me?.userId) return null;

      const [profileRes, projectsRes] = await Promise.all([
        supabase.from("profiles").select("id, handle, display_name").eq("id", me.userId).single(),
        supabase
          .from("projects")
          .select("id, title, status")
          .eq("profile_id", me.userId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      return {
        profile: (profileRes.data ?? null) as { id: string; handle: string | null; display_name: string | null } | null,
        projects: (projectsRes.data ?? []) as { id: string; title: string; status: string }[],
      };
    },
    enabled: !!me?.userId,
  });

  if (meLoading || dataLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading studio...</p>
        </div>
      </div>
    );
  }

  if (!me?.userId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="max-w-sm text-center">
          <p className="text-sm text-muted-foreground">Sign in to access the Creativity Studio.</p>
          <Link to="/login" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Studio
      userId={me.userId}
      profile={studioData?.profile ?? null}
      projects={studioData?.projects ?? []}
    />
  );
}