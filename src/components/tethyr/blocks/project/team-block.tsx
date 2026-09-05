// ── Project Team Block ───────────────────────────────────────────────────────
// Shows project contributors with avatars, names, and roles.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  signed_avatar_url: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  creator: "Creator",
  mentor: "Mentor",
  contributor: "Contributor",
};

function ProjectTeamBlock({ config, context }: BlockProps) {
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
      const rows = (data ?? []) as unknown as ContributorRow[];
      // avatars is a private bucket — render signed URLs, never raw paths.
      const avatarTargets = rows.filter((r) => r.profiles?.avatar_url);
      if (avatarTargets.length > 0) {
        const { data: signed } = await supabase.storage.from("avatars").createSignedUrls(
          avatarTargets.map((r) => r.profiles!.avatar_url as string),
          60 * 60,
        );
        for (const item of signed ?? []) {
          if (item.error || !item.signedUrl) continue;
          const target = avatarTargets.find((r) => r.profiles?.avatar_url === item.path);
          if (target) target.signed_avatar_url = item.signedUrl;
        }
      }
      return rows;
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

  // In edit mode, always show the block even when empty so the owner can interact with it.
  if (!contributors || contributors.length === 0) {
    if (context.isEditing) {
      return (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 text-xs text-muted-foreground">
          Team block — contributors will appear here when added.
        </div>
      );
    }
    return null;
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-foreground">
        Team <span className="text-muted-foreground">({contributors.length})</span>
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {contributors.map((c) => {
          const profile = c.profiles;
          const initial = (profile?.display_name ?? profile?.handle ?? "?").charAt(0).toUpperCase();
          return (
            <div
              key={c.profile_id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5"
            >
              {config.showAvatars !== false && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={c.signed_avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0 flex-1">
                <ProfileLink
                  handle={profile?.handle ?? null}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {profile?.display_name ?? profile?.handle ?? "Unnamed"}
                </ProfileLink>
                {config.showRoles !== false && (
                  <p className="text-xs text-muted-foreground">{ROLE_LABEL[c.role] ?? c.role}</p>
                )}
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
  defaults: { showRoles: true, showAvatars: true },
  fields: [
    { key: "showRoles", label: "Show roles", type: "toggle" },
    { key: "showAvatars", label: "Show avatars", type: "toggle" },
  ],
  component: ProjectTeamBlock,
});

export { ProjectTeamBlock };
