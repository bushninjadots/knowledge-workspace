import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { CreationStudio } from "@/components/tethyr/studio/creation-studio";

import "@/components/tethyr/blocks/register-all";

export const Route = createFileRoute("/_authenticated/studio")({
  component: StudioRoute,
  head: () => ({
    meta: [{ title: "Creation Studio — Tethyr" }],
  }),
});

function StudioRoute() {
  const navigate = useNavigate();
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const { data: studioData, isLoading: dataLoading } = useQuery({
    queryKey: ["studio-profile", me?.userId],
    queryFn: async () => {
      if (!me?.userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, handle, display_name")
        .eq("id", me.userId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        handle: string | null;
        display_name: string | null;
      } | null;
    },
    enabled: !!me?.userId,
  });

  if (meLoading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading Creation Studio…</p>
        </div>
      </div>
    );
  }

  if (!me?.userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm text-muted-foreground">Sign in to customize your Studio.</p>
          <Link
            to="/login"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CreationStudio
      userId={me.userId}
      profile={studioData ?? null}
      onCompleteProfile={() => navigate({ to: "/profile" })}
    />
  );
}
