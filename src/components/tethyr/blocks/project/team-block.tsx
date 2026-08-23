// ── Project Team Block ───────────────────────────────────────────────────────
// Shows project contributors with avatars, names, and roles.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileLink } from "@/components/tethyr/profile-link";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type ContributorRow = {
  profile_id: string;
  role: string;
  profiles: {
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  } | null;
};

const ROLE_LABEL: Record<string, string> = {
  creator: "Creator",
  mentor: "Mentor",
  contributor: "Contributor",
};

function ProjectTeamBlock({ context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;

  const { data: contributors, isLoading } = useQuery({
    queryKey: ["project-team", projectId],
    queryFn: async (): Promise<ContributorRow[]> => {
      if (!projectId) return [];
      const { data } = await supabase
        .from("project_contributors")
        .select("profile_id, role, profiles(id, display_name, handle, avatar_url)")
        .eq("project_id", projectId)
        .order("role", { ascending: true });
      return (data ?? []) as unknown as ContributorRow[];
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-24" />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!contributors || contributors.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-foreground">
        Team{" "}
        <span className="text-muted-foreground">({contributors.length})</span>
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {contributors.map((c) => {
          const profile = c.profiles;
          const initial = (profile?.display_name ?? profile?.handle ?? "?").charAt(0).toUpperCase();
          return (
            <div key={c.profile_id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{initial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <ProfileLink
                  handle={profile?.handle ?? null}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {profile?.display_name ?? profile?.handle ?? "Unnamed"}
                </ProfileLink>
                <p className="text-xs text-muted-foreground">{ROLE_LABEL[c.role] ?? c.role}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

registerBlock({
  type: "project-team",
  category: "people",
  label: "Team",
  description: "The project's contributors — creator, mentors, and contributors.",
  icon: "Users",
  defaults: {},
  component: ProjectTeamBlock,
});

export { ProjectTeamBlock };